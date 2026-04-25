# Phase 3 — Paywall + DRM Streaming Design

**Date:** 2026-04-25
**Status:** Spec, ready for plan
**Scope:** Stripe Connect Express paywall, lifetime streaming purchases, HLS+AES-128 DRM, artist-controlled preview windows, party-live discount, payout dashboard.
**Out of scope:** Subscription model, gifting, lossless tier, mobile native apps, multi-currency.

---

## 1. Goal

Enable artists to monetize their releases via a pay-what-you-want (PWYW) model with a formula-driven minimum, while keeping the audio asset itself protected by HLS+AES-128 DRM so a casual download is non-trivial.

The same DRM pipeline serves three audiences:
- Anonymous visitors → 30-second MP3 preview, artist-controlled.
- Listeners during a live listening party → full track for the duration of the party only.
- Lifetime purchasers → full track forever, even if the release is later archived.

## 2. Architecture overview

```
┌────────────┐       ┌──────────────┐       ┌─────────┐
│ Next.js    │──────▶│ Supabase     │       │ R2      │
│ (Railway)  │       │ (Hetzner VPS)│       │ (audio) │
└─────┬──────┘       └──────┬───────┘       └────┬────┘
      │                     │                     ▲
      │ Stripe Checkout     │                     │ HLS .ts segments
      ▼                     ▼                     │ + .m3u8 manifests
┌────────────┐       ┌──────────────┐             │ + AES key file
│ Stripe API │       │ Encoder      │─────────────┘
│ (Connect)  │       │ Worker       │
└─────┬──────┘       │ (Railway)    │
      │ webhook      │ FFmpeg       │
      └─────────────▶│ + ffprobe    │
                     └──────────────┘
```

Three new moving parts on top of phase 2:

1. **Encoder Worker** — separate Railway service running Node + FFmpeg. Pulls jobs from a `encode_jobs` table, transcodes uploaded source audio into HLS+AES segments + 30-second MP3 preview, writes outputs to R2, marks job complete.
2. **Stripe layer** — Connect Express onboarding for artists, Stripe Checkout for buyers, webhook handler updating `purchases` and `payouts` tables.
3. **Key delivery + manifest signing** — Next.js API routes that authenticate the request and serve the AES key (or a signed manifest URL) only if the caller is entitled.

## 3. Tech stack

- **Encoder:** Node 20 + `fluent-ffmpeg` + `ffmpeg-static` on a dedicated Railway service. Polls `encode_jobs` every 5 s.
- **Stripe:** `stripe` SDK (server), Stripe Checkout (hosted), Stripe Connect Express (artist onboarding), Stripe Tax (auto VAT).
- **Storage layout in R2:**
  - `audio-source/<artist_id>/<release_id>/<track_id>.<ext>` — original upload (private, kept for re-encode if preview window changes).
  - `audio-stream/<artist_id>/<release_id>/<track_id>/playlist.m3u8` — manifest.
  - `audio-stream/<artist_id>/<release_id>/<track_id>/seg-NNN.ts` — encrypted segments.
  - `audio-stream/<artist_id>/<release_id>/<track_id>/key.bin` — 16-byte AES key, never publicly readable.
  - `audio-preview/<artist_id>/<release_id>/<track_id>.mp3` — 30 s plain MP3.
- **Player:** `hls.js` for non-Safari browsers, native HLS on Safari/iOS. Both pass the `Authorization: Bearer <token>` header on .m3u8 + key fetches via `xhrSetup`.

## 4. Data model

### New tables

```sql
-- Purchase records. One per (buyer, release) pair. Lifetime, immutable
-- once paid. status reflects Stripe state machine (succeeded, refunded).
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paid_cents int NOT NULL,
  amount_min_cents int NOT NULL,
  tip_cents int GENERATED ALWAYS AS (amount_paid_cents - amount_min_cents) STORED,
  platform_fee_cents int NOT NULL,
  artist_payout_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_session_id text UNIQUE NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'refunded')),
  party_discount_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  UNIQUE (buyer_id, release_id)  -- one purchase per release per buyer
);

-- Encoding jobs. Polled by the encoder worker.
CREATE TABLE public.encode_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('full', 'preview')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_encode_jobs_pending ON encode_jobs(status, created_at)
  WHERE status = 'pending';

-- Stripe webhook event ledger (idempotency).
CREATE TABLE public.stripe_events (
  id text PRIMARY KEY,  -- evt_xxx from Stripe
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload jsonb NOT NULL
);
```

### Schema deltas on existing tables

```sql
ALTER TABLE public.tracks
  ADD COLUMN preview_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN preview_start_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN hls_manifest_key text,           -- R2 key of playlist.m3u8
  ADD COLUMN aes_key_id text,                 -- internal key id (R2 path)
  ADD COLUMN encode_status text NOT NULL DEFAULT 'pending'
    CHECK (encode_status IN ('pending', 'encoding', 'ready', 'failed'));

ALTER TABLE public.tracks
  ADD CONSTRAINT preview_window_in_bounds
    CHECK (preview_start_seconds + 30 <= duration_seconds);

ALTER TABLE public.releases
  ADD COLUMN party_live_discount_pct int NOT NULL DEFAULT 20
    CHECK (party_live_discount_pct BETWEEN 0 AND 50);
  -- Per-release override; 20% is the platform default per spec.
```

### Pricing helpers

`lib/pricing.ts` already exports `getPrice(trackCount)` returning the canonical minimum (formula `ceil(n × 0.6) − 0.01`). Phase 3 layers:

```ts
function effectiveMin(release, isPartyLive: boolean): number {
  const base = getPrice(release.track_count);
  if (!isPartyLive) return base;
  const discount = release.party_live_discount_pct / 100;
  return Number((base * (1 - discount)).toFixed(2));
}
```

## 5. Stripe integration

### 5.1 Artist onboarding (Connect Express)

Existing `app/api/artist/stripe/connect/route.ts` already creates a Connect account + onboarding link. Phase 3 extends it:

- After onboarding callback (`/api/artist/stripe/return`), refresh the account capabilities and set `profiles_stripe.payout_enabled = true` once `charges_enabled` and `payouts_enabled` are both true.
- Show a payout dashboard at `/artist/payouts` reading from Stripe Connect (balance, recent payouts).

### 5.2 Buyer checkout

- `POST /api/releases/:id/checkout` — creates a Stripe Checkout Session.
  - `mode: 'payment'`
  - `payment_method_types: ['card']`
  - `line_items: [{ price_data: { unit_amount: amountCents, currency: 'usd', product_data: { name: release.title } }, quantity: 1 }]`
  - `payment_intent_data: { application_fee_amount: Math.round(amountCents * 0.15), transfer_data: { destination: artist.stripe_account_id } }`
  - `automatic_tax: { enabled: true }`
  - `customer_email` if user is logged in
  - `success_url` / `cancel_url` back to `/r/:slug`
  - Server-side determines `amountCents`:
    - Reads `effectiveMin(release, partyLive)`
    - Accepts client-supplied `amount_cents ≥ amountMin` (PWYW)
    - Inserts a `purchases` row with `status='pending'` to reserve the session
- Client redirects to `session.url`.

### 5.3 Webhooks

`POST /api/webhooks/stripe` — single endpoint, dispatches by event type:

- `checkout.session.completed` → mark purchase `status='succeeded'`, record charge id.
- `charge.refunded` → mark purchase `status='refunded'` (rare; manual support cases only).
- `account.updated` → refresh `profiles_stripe.payout_enabled`.
- `payout.paid` / `payout.failed` → store in a future `payouts_log` table (Phase 3.5 if needed).

All inserts go through `stripe_events` first for idempotency. Same `evt_id` twice = no-op.

### 5.4 Discount during party

The Stripe session is created server-side with the live discount already baked into `unit_amount`. Eligibility is checked at session creation time:

```sql
SELECT EXISTS (
  SELECT 1 FROM listening_parties
  WHERE release_id = $1
    AND status = 'live'
    AND ends_at > now()
);
```

Race: if a party ends between checkout creation and payment, the buyer keeps the discount. That's acceptable.

## 6. Encoder worker

A second Railway service (`encoder/`), dedicated. Architecture:

- Polls `SELECT * FROM encode_jobs WHERE status='pending' ORDER BY created_at LIMIT 1` every 5 s with `FOR UPDATE SKIP LOCKED` to claim atomically.
- Marks `status='running'` and downloads the source from R2.
- Runs FFmpeg in two passes:
  1. **Full HLS+AES** — `ffmpeg -i source.mp3 -c:a aac -b:a 256k -hls_time 6 -hls_key_info_file key.info -hls_segment_filename "seg-%03d.ts" -hls_playlist_type vod playlist.m3u8`. The `key.info` file contains a freshly generated 16-byte key + an HTTPS URL pointing to our key endpoint.
  2. **Preview MP3** — `ffmpeg -i source.mp3 -ss <preview_start> -t 30 -c:a mp3 -b:a 128k preview.mp3`.
- Uploads outputs to R2 at the keys defined in §3.
- Updates `tracks.encode_status='ready'` + sets `hls_manifest_key`, `aes_key_id`, `preview_url`.
- Marks job `status='succeeded'`.

If `preview_start_seconds` changes after publication, a new `kind='preview'` job is enqueued to re-encode just the preview (full HLS untouched).

If FFmpeg fails 3× the job goes `status='failed'` and the artist gets an in-app notification + email "Track upload couldn't be processed, contact support."

## 7. Key delivery + manifest signing

### 7.1 Manifest endpoint

`GET /api/tracks/:id/manifest` — returns a signed R2 URL pointing at the `playlist.m3u8`, TTL 5 min.

- Authorization paths (any one passes):
  - Artist owner of the track's release
  - Buyer with `purchases.status='succeeded'` on the release
  - Authenticated user during a live party for the release
- All other callers → 403.
- Anonymous users wanting a preview hit a different endpoint: `GET /api/tracks/:id/preview` returning a public R2 URL for the 128 k MP3, no auth required, but only if `track.preview_enabled = true`.

### 7.2 Key endpoint

`GET /api/tracks/:id/key` — returns the raw 16-byte AES key as `application/octet-stream`.

- Authorization is identical to manifest (owner / buyer / live-party listener).
- Cache: `Cache-Control: private, max-age=300` so the player doesn't re-fetch every segment.
- The key URL is embedded by the encoder into the manifest's `#EXT-X-KEY` line:
  `#EXT-X-KEY:METHOD=AES-128,URI="https://synthcamp.net/api/tracks/<id>/key",IV=0x...`

### 7.3 Player

- Uses `hls.js` config with custom `xhrSetup` that adds the `Authorization: Bearer <session-jwt>` header on every fetch (manifest, key, segments). Supabase session JWT is read client-side from cookies.
- Native iOS Safari path: hls.js polyfills don't apply; the manifest URL itself carries a short-lived signed token (`?token=...`) that the manifest endpoint validates instead.

## 8. UI flows

### 8.1 Artist — wizard step 2 (Tracks) gains preview controls

Per uploaded track, a small panel:
- Toggle **Allow 30 s preview** (default ON)
- If ON: timeline scrubber to pick the start position. Preview the chosen 30 s in-page using `<audio>`. Default 0s.
- Saving the field PATCHes `tracks.preview_start_seconds` and enqueues a `kind='preview'` re-encode if the track was already encoded.

### 8.2 Artist — payouts dashboard

`/artist/payouts` reads from Stripe Connect:
- Available balance + pending balance
- Last 12 months of `payout` events
- Link to Stripe Express dashboard for full history
- Tax document download (Stripe-hosted)

### 8.3 Buyer — purchase flow

On `/r/:slug`:
- Anonymous / non-buyer: 30 s preview button per track + "Buy from $X" CTA.
- During party live: CTA changes to "**Buy now $X (-20% party discount)**" with a small countdown ("ends in 14:23").
- Click → `/r/:slug/checkout` server route creates Stripe Session, redirects.
- Success URL → `/r/:slug?purchase=success` shows toast + reveals full tracklist.

`/explore/library` lists all releases the user has purchased, with full streaming access.

### 8.4 Listener during party

Already has a Wait button. Phase 3 adds: when party transitions to `live`, the buy CTA in `/party/:id` page is enabled with the discount pricing. Same flow as §8.3.

## 9. Edge cases

| Case | Behavior |
|---|---|
| Release archived after purchase | Buyer keeps lifetime access via `purchases` row; release hidden from public catalog/search |
| Release deleted (only possible while draft) | No purchases possible at draft stage; nothing to refund |
| Party cancelled (was scheduled) | No pre-orders existed; nothing to refund |
| Party cancelled (was live) | Cannot cancel a live party (UI disables the action); buyers during live keep their purchase |
| Refund initiated by Stripe support | `charge.refunded` webhook flips purchase status; buyer loses access on next manifest fetch |
| Buyer's card chargeback | Same flow as refund; lose access |
| Artist banned mid-party | Existing ban cascade archives the release; buyers keep access (as above) |
| Preview start changed after publish | Re-encode only the preview; full HLS untouched |
| Track replaced (PATCH audio_source_key) | Both full HLS and preview re-encode; old segments garbage-collected after 24 h |

## 10. Migration list (in deploy order)

1. `20260426000001_purchases.sql` — purchases table + indexes + RLS
2. `20260426000002_encode_jobs.sql` — jobs queue + RLS (service-role only)
3. `20260426000003_stripe_events.sql` — webhook ledger
4. `20260426000004_tracks_drm_columns.sql` — preview/HLS columns + check constraint
5. `20260426000005_releases_party_discount.sql` — `party_live_discount_pct` column
6. `20260426000006_purchase_rpcs.sql` — `effective_min_price()`, `is_release_purchasable()`, `record_purchase()` SECURITY DEFINER helpers
7. `20260426000007_track_encode_trigger.sql` — trigger on `tracks` insert/update enqueues encode jobs

## 11. Testing strategy

### Unit
- `lib/pricing.ts:effectiveMin` covers party-discount math
- Webhook event handler dedupes via `stripe_events`
- Manifest endpoint returns 403 for unauthorized vs 200 with signed URL

### Integration / E2E (Playwright)
- Anonymous user can preview but not stream full track
- Logged-in non-buyer cannot stream full track
- Party-live listener can stream during party only
- Stripe test-mode purchase flow end-to-end (using `stripe trigger` in CI)
- After purchase, `/explore/library` shows the release
- Artist sees payout balance update after webhook

### Manual smoke
- Encode worker actually transcodes a 4-minute MP3 to HLS+AES in <30 s on Railway's hardware
- Player works on iOS Safari (native HLS) and desktop Chrome (hls.js)

## 12. Risks and rollback

- **R2 egress cost** scales with stream count. Monitor monthly. Cloudflare R2 is free egress to Cloudflare consumers, so we're fine if traffic stays on the Cloudflare network. If we ever serve from a non-CF CDN, costs spike.
- **Encoder worker death** → jobs pile up, new uploads stuck in `encode_status='pending'`. Health-check + alert via Railway.
- **Stripe Connect Express limits** at high TPS (~100 charges/sec). Phase 4+ concern.
- **DRM not actually unbreakable** — a determined user can decrypt the AES segments with the key (since we serve it to authorized players). The goal is friction, not air-tight protection.

Rollback path: feature-flag `phase3_paywall_enabled` on `profiles` (default off, opt-in per artist). If the system breaks, disable the flag globally and the Buy CTA disappears, existing purchases keep playing.

## 13. Estimated work

- Schema migrations + RPCs: ~0.5 day
- Encoder worker (boilerplate + FFmpeg pipeline + R2 upload + job claim): ~1.5 day
- Stripe Checkout + Connect refresh + webhook handler: ~1 day
- Manifest + key endpoints + hls.js wiring: ~1 day
- UI: artist preview controls, buy CTAs, library, payouts dashboard: ~1 day
- Tests + smoke: ~0.5 day

Total ≈ 5.5 dev-days.
