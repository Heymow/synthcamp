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
  - `audio-source/artist_<user_id>/release_<release_id>/track_<n>.<ext>` — original upload (private, kept for re-encode if preview window changes). This path is already produced by `app/api/tracks/[id]/upload-url/route.ts` and stored in `tracks.audio_source_key`. The encoder reads the path from the column directly; no derivation needed.
  - `audio-stream/<artist_id>/<release_id>/<track_id>/playlist.m3u8` — manifest.
  - `audio-stream/<artist_id>/<release_id>/<track_id>/seg-NNN.ts` — encrypted segments.
  - `audio-stream/<artist_id>/<release_id>/<track_id>/key.bin` — 16-byte AES key, never publicly readable. The path is derived from `track.id` (stored as `tracks.aes_key_id uuid`) plus `release_id` / `artist_id`; no separate text path column needed.
  - `audio-preview/<artist_id>/<release_id>/<track_id>.mp3` — 30 s plain MP3, URL stored in `tracks.preview_url`.
- **Player:** `hls.js` for non-Safari browsers (passes `Authorization: Bearer <token>` via `xhrSetup` on .m3u8 + key fetches); native HLS on Safari/iOS, where AVFoundation ignores `xhrSetup`, so we use per-request signed manifests with a JWT embedded in the key URI instead. Full mechanics in §7.4.

## 4. Data model

### New tables

**Note on existing `purchases` table.** Phase 2 migration `20260422000008_purchases.sql` already created a stub `public.purchases` with a different schema (`amount_paid numeric(10,2)`, `stripe_payment_intent text`, `purchased_at`, no status field, no platform_fee/artist_payout/tip split). It was created as a placeholder, marked "populated Phase 3," and is **empty in production** (no purchases exist yet because Stripe wasn't wired). Phase 3 replaces the stub with the production schema below via a `DROP TABLE … CASCADE` + `CREATE TABLE` in migration #1. The drop also removes the existing RLS policy `purchases_select_self_or_artist` and the index `idx_purchases_release_date`, both of which are recreated under the new shape. **This DROP is destructive** — if any seeded test data exists in staging it will be wiped; production has no real rows so no business impact.

```sql
-- Phase 3 replacement schema for purchases. Drops the phase 2 stub first.
DROP TABLE IF EXISTS public.purchases CASCADE;

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
  succeeded_at timestamptz
);

-- One non-refunded purchase per release per buyer. A refunded buyer can repurchase.
CREATE UNIQUE INDEX idx_purchases_one_per_buyer_release
  ON public.purchases (buyer_id, release_id)
  WHERE status != 'refunded';

CREATE INDEX idx_purchases_artist ON public.purchases (artist_id, succeeded_at DESC)
  WHERE status = 'succeeded';

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

**Reuse existing columns from phase 2.** `tracks.aes_key_id (uuid)`, `tracks.hls_manifest_key (text)`, `tracks.audio_source_key (text)`, and `tracks.preview_url (text)` were created in `20260422000005_tracks.sql` and `20260423000001_tracks_preview_url.sql`. Phase 3 does not re-add them. `aes_key_id` stays `uuid` and the actual R2 key path is derived at read time as `audio-stream/<artist_id>/<release_id>/<track_id>/key.bin` (the column value equals `track.id` for newly-encoded tracks).

The only ALTERs phase 3 introduces:

```sql
ALTER TABLE public.tracks
  ADD COLUMN preview_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN preview_start_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN encode_status text NOT NULL DEFAULT 'pending'
    CHECK (encode_status IN ('pending', 'encoding', 'ready', 'failed'));

-- Backfill existing tracks: anything with an HLS manifest already in R2
-- (i.e. tracks uploaded under phase 2 with the old upload route) should
-- start in 'ready' state, not 'pending'. Otherwise the trigger added in
-- migration #8 would queue a re-encode for every existing track at
-- deploy time. New uploads after this point default to 'pending' and
-- are picked up by the worker normally.
UPDATE public.tracks
SET encode_status = 'ready'
WHERE hls_manifest_key IS NOT NULL;

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

### 4.6 RLS policies on new tables

Each new table enables RLS. Service-role bypasses RLS (used by webhook + encoder worker).

```sql
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select_self_or_artist_or_admin
  ON public.purchases FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR artist_id = auth.uid()
    OR public.is_current_user_admin()
  );

-- Writes happen exclusively via the Stripe webhook handler running with the
-- service-role key. No client-side INSERT / UPDATE / DELETE policy is granted.

ALTER TABLE public.encode_jobs ENABLE ROW LEVEL SECURITY;
-- No policies. Only the encoder worker (service-role) and the trigger that
-- enqueues jobs (also service-role via SECURITY DEFINER) can touch this table.

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies. Webhook-only.
```

**Tracks RLS extension for purchasers.** Phase 2's `tracks_select_via_release` policy hides tracks once a release is archived. Buyers must keep access. Drop and recreate:

```sql
DROP POLICY tracks_select_via_release ON public.tracks;

CREATE POLICY tracks_select_via_release ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id
        AND (
          r.status IN ('published', 'unlisted', 'scheduled')
          OR r.artist_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.purchases p
            WHERE p.buyer_id = auth.uid()
              AND p.release_id = r.id
              AND p.status = 'succeeded'
          )
        )
    )
  );
```

## 5. Stripe integration

### 5.1 Artist onboarding (Connect Express)

Existing `app/api/artist/stripe/connect/route.ts` already creates a Connect account + onboarding link. Phase 3 extends it:

- After onboarding callback (`/api/artist/stripe/return`), refresh the account capabilities and set `profiles_stripe.payout_enabled = true` once `charges_enabled` and `payouts_enabled` are both true.
- Show a payout dashboard at `/artist/payouts` reading from Stripe Connect (balance, recent payouts).

### 5.2 Buyer checkout

- `POST /api/releases/:id/checkout` — creates a Stripe Checkout Session.
  - **Charge model: destination charges.** The platform owns the customer relationship (we hold the buyer email, the receipt comes from synthcamp.net, the charge lives on the platform account). Funds settle to the platform balance and are immediately transferred to the artist's connected account, minus our application fee.
  - `mode: 'payment'`
  - `payment_method_types: ['card']`
  - `line_items: [{ price_data: { unit_amount: amountCents, currency: 'usd', product_data: { name: release.title } }, quantity: 1 }]`
  - **Session-level transfer / fee** (NOT in `payment_intent_data` — destination charges set these at the session level):
    - `payment_intent_data: { application_fee_amount: Math.round(amountCents * 0.15), transfer_data: { destination: artist.stripe_account_id } }`
  - `automatic_tax: { enabled: true }` — **gate on capability**: only enable if `account.tax.automatic_tax.status === 'enabled'`. If the artist hasn't set up Stripe Tax, omit this flag and they're responsible for their own tax compliance. Decide at session-creation time by fetching the latest account snapshot.
  - `customer_email` if user is logged in
  - `success_url` / `cancel_url` back to `/r/:slug`
  - **Idempotency-Key header** on the Stripe Session create call:
    `Idempotency-Key: checkout:<buyer_id>:<release_id>:<minute_bucket>` where `minute_bucket = Math.floor(Date.now() / 60000)`. Absorbs double-clicks within the same minute without creating duplicate sessions.
  - Server-side determines `amountCents`:
    - Reads `effectiveMin(release, partyLive)` and converts to cents.
    - Accepts client-supplied `amount_cents`. Server validates:
      - `Number.isInteger(amount_cents)` and `> 0`
      - `amount_cents >= effectiveMin(release, partyLive) * 100` (lower bound)
      - `amount_cents <= 100000` (upper bound = $1000 hard cap; prevents fat-finger / abuse)
    - Reject with HTTP 400 otherwise.
    - Inserts a `purchases` row with `status='pending'` to reserve the session.
- **Refunds.** Use the Stripe `Refund` API on the platform charge with `refund_application_fee: true` and `reverse_transfer: true` so the platform claws back its 15% application fee and the artist's portion is reverse-transferred from their connected account. See §5.5.
- Client redirects to `session.url`.

### 5.3 Webhooks

`POST /api/webhooks/stripe` — single endpoint, dispatches by event type.

**Signature verification (mandatory).** Next.js App Router parses JSON by default; Stripe signature checks require the **raw, byte-exact request body**. The handler:

```ts
export async function POST(request: NextRequest) {
  const rawBody = await request.text(); // NOT request.json()
  const sig = request.headers.get('stripe-signature');
  if (!sig) return new NextResponse('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new NextResponse('invalid signature', { status: 400 });
  }

  // Dedup. Insert evt_id; if it conflicts, the event is already being / has been
  // processed → respond 200 and bail.
  const { error: dupErr } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event });
  if (dupErr?.code === '23505') return new NextResponse(null, { status: 200 });

  // …dispatch by event.type…
}
```

Dispatch table:

- `checkout.session.completed` → mark purchase `status='succeeded'`, record `payment_intent` + `charge` ids, set `succeeded_at = now()`.
- `checkout.session.expired` → DELETE the pending `purchases` row reserved at session creation (status='pending'). Keeps the table clean.
- `charge.refunded` → mark purchase `status='refunded'`. Buyer loses access on next manifest fetch.
- `account.updated` → refresh `profiles_stripe.payout_enabled` from `charges_enabled && payouts_enabled`.
- `payout.paid` / `payout.failed` → store in a future `payouts_log` table (Phase 3.5 if needed).

All processed events have their `processed_at` updated in `stripe_events` after successful handling. Same `evt_id` arriving twice short-circuits via the unique-key conflict above.

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

### 5.5 Refund flow

- **Initiator: admin only.** No buyer self-service in phase 3. Buyers contact support; an admin uses an internal tool that calls the Stripe API.
- **Stripe call:**
  ```ts
  await stripe.refunds.create({
    charge: purchase.stripe_charge_id,
    refund_application_fee: true, // platform's 15% returns to platform balance
    reverse_transfer: true,        // funds pulled back from artist's connected account
  });
  ```
- **Stripe processing fee.** Stripe does NOT refund their fixed processing fee on a refund. The platform absorbs this cost (or, depending on `reverse_transfer` math, it can be split with the artist; see Stripe Connect docs). Phase 3 simplification: platform eats the fee.
- **Webhook arrival.** Stripe fires `charge.refunded`; the handler flips `purchases.status = 'refunded'`.
- **Access revocation.** The manifest endpoint always re-checks `purchases.status = 'succeeded'` per request — there is no cached entitlement. Next manifest fetch returns 403 and playback stops at the current segment boundary.
- **Re-purchase.** Because the unique index on `purchases (buyer_id, release_id)` excludes refunded rows (see §4), the same buyer can buy again later if they choose.

## 6. Encoder worker

A second Railway service (`encoder/`), dedicated. Architecture:

- **Atomic job claim via SECURITY DEFINER RPC.** A bare `SELECT … FOR UPDATE SKIP LOCKED` from a background worker is brittle (transaction handling across the Supabase client, role permissions, retry semantics). Instead, ship a server-side function:

  ```sql
  CREATE FUNCTION public.claim_next_encode_job()
  RETURNS public.encode_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    j public.encode_jobs;
  BEGIN
    SELECT * INTO j
      FROM public.encode_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    UPDATE public.encode_jobs
      SET status = 'running',
          claimed_at = now(),
          attempts = attempts + 1
      WHERE id = j.id
      RETURNING * INTO j;

    RETURN j;
  END;
  $$;
  REVOKE ALL ON FUNCTION public.claim_next_encode_job() FROM public, authenticated, anon;
  -- Only the service-role used by the encoder worker can call it.
  ```

  The encoder worker calls `supabase.rpc('claim_next_encode_job')` every 5 s. Returns the claimed row or null.

- After claim: downloads the source from R2 (path read from `tracks.audio_source_key`).
- Runs FFmpeg in two passes:
  1. **Full HLS+AES** — `ffmpeg -i source.mp3 -c:a aac -b:a 256k -hls_time 6 -hls_key_info_file key.info -hls_segment_filename "seg-%03d.ts" -hls_playlist_type vod playlist.m3u8`. The `key.info` file contains a freshly generated 16-byte key + an HTTPS URL pointing to our key endpoint.
  2. **Preview MP3** — `ffmpeg -i source.mp3 -ss <preview_start> -t 30 -c:a mp3 -b:a 128k preview.mp3`.
- Uploads outputs to R2 at the keys defined in §3.
- Updates `tracks.encode_status='ready'` + sets `hls_manifest_key`, `aes_key_id` (= `track.id`), `preview_url`.
- Marks job `status='succeeded'`, `finished_at = now()`.

**Re-encode throttle on preview-start changes.** When the artist drags the preview-start slider in the wizard, the client debounces the PATCH to `tracks.preview_start_seconds` by 500 ms after the last `change` event. On each PATCH that mutates the value, the trigger enqueues a new `kind='preview'` job. To prevent a queue of stale jobs, the worker (or the trigger) collapses pending preview jobs for the same track:

```sql
DELETE FROM public.encode_jobs
  WHERE track_id = NEW.track_id
    AND kind = 'preview'
    AND status = 'pending'
    AND id <> NEW.id;
```

Only the latest pending preview job survives. The full-HLS job is never collapsed since the source audio dictates it.

**Failure recovery.** If FFmpeg fails 3× the job goes `status='failed'` and the artist gets an in-app notification + email "Track upload couldn't be processed, contact support." The artist can:

- Click **Retry encoding** in the wizard → enqueues a fresh job and resets `tracks.encode_status='pending'`.
- Click **Replace audio** → re-uploads the source via `app/api/tracks/[id]/upload-url`, the trigger then enqueues a full re-encode.

The wizard surfaces these two actions when `encode_status='failed'`. See §8.1.

### 6.5 Storage and egress estimates

Sizing as of phase 3 launch assumptions:

| Artifact | Size |
|---|---|
| 4-min track @ 256k AAC HLS | ~7.5 MB encoded |
| 8-track album, encoded only | ~60 MB |
| 8-track album, encoded + retained source | ~120 MB |
| **1000 releases** | ~120 GB R2 storage |
| Listening party, 100 concurrent listeners × 30 min | ~11 GB egress |

- R2 egress to the Cloudflare network is free. Non-CF egress (e.g. the Railway-hosted encoder pulling source from R2) **does** incur egress cost — but it happens once per encode, so it stays minor.
- Source audio is retained because preview-window changes require re-encoding the preview slice. Optional future tweak: drop sources after, say, 90 days of no changes.

## 7. Key delivery + manifest signing

**DRM threat model (called out up front).** HLS+AES-128 with a key endpoint we control prevents casual download via right-click-save and basic devtools network-tab inspection. A determined user with knowledge of HLS internals can save the encrypted segments + the key from devtools (or via `mitmproxy`) and decrypt offline. This is the same model used by Apple Music and most major streaming services in their non-DRM tier. We accept this trade-off vs the operational complexity of Widevine / FairPlay (CDM provisioning, license servers, per-platform DRM stacks). If the platform later needs studio-grade DRM for licensed catalogue, that is a phase-N upgrade, not a phase 3 concern.

### 7.1 Manifest endpoint

`GET /api/tracks/:id/manifest` — returns a **rewritten manifest** (not a redirect to R2). The endpoint fetches the static `playlist.m3u8` from R2, mints a short-lived JWT, rewrites the `#EXT-X-KEY` URI to embed the JWT, and returns the rewritten body. Full mechanics in §7.4.

- Authorization paths (any one passes):
  - Artist owner of the track's release.
  - Buyer with `purchases.status='succeeded'` on the release.
  - Live-party listener with an active `party_alerts` subscription on the party for this release, party `status='live'`, and `ends_at > now()` (see §7.2 for the exact gate; same checks here).
- All other callers → 403.
- Anonymous users wanting a preview hit a different endpoint: `GET /api/tracks/:id/preview` returning a public R2 URL for the 128 k MP3, no auth required, but only if `track.preview_enabled = true`.

### 7.2 Key endpoint

`GET /api/tracks/:id/key` — returns the raw 16-byte AES key as `application/octet-stream`.

- **Authorization** (any one passes):
  - Artist owner of the track's release.
  - Buyer with `purchases.status='succeeded'` on the release.
  - **Live-party listener** with all of: an active `party_alerts` subscription on the party for this release, the party's `status='live'`, and `ends_at > now()`. The party-listener tier is *not* "any authenticated user"; the alert-subscription gate prevents drive-by hits on the key endpoint while a popular party is live.
- **Cache** depends on the entitlement source:
  - Purchaser: `Cache-Control: private, max-age=300` — keys rarely change for a paid release; the player can reuse for 5 minutes.
  - Live-party listener: `Cache-Control: no-store` — entitlement evaporates the moment the party ends, so we must re-check on every segment-set fetch.
  - Owner: `private, max-age=300` (treated like a purchaser).
- The key URL is embedded by the encoder into the manifest's `#EXT-X-KEY` line:
  `#EXT-X-KEY:METHOD=AES-128,URI="https://synthcamp.net/api/tracks/<id>/key",IV=0x...`
- **Dual auth on the endpoint:** accepts either an `Authorization: Bearer <jwt>` header (hls.js path) OR a `?token=<jwt>` query parameter (iOS native HLS path; see §7.4). Same JWT, same validation, same entitlement check.

### 7.3 Player

- Uses `hls.js` config with custom `xhrSetup` that adds the `Authorization: Bearer <session-jwt>` header on every fetch (manifest, key, segments). Supabase session JWT is read client-side from cookies.
- Native iOS Safari path: hls.js does not load; the manifest is fetched directly by AVFoundation. See §7.4 for the per-request manifest signing that makes this work.

### 7.4 iOS Safari native HLS — per-request signed manifests

iOS Safari plays HLS natively via AVFoundation and **ignores hls.js's `xhrSetup`**, so we cannot inject an `Authorization` header on the manifest, key, or segment requests. The manifest's baked-in `#EXT-X-KEY:URI=...` line points at a fixed URL with no auth — left alone, an unauthenticated user could fetch the key by hitting that URL directly.

**Solution: server-side rewrite the manifest on every request, embedding a short-lived JWT into the key URI.**

`GET /api/tracks/:id/manifest` (already defined in §7.1) does:

1. Authorize the caller (owner / buyer / live-party listener) — same checks as today.
2. Fetch the static `playlist.m3u8` from R2.
3. Mint a short-lived JWT (TTL 5 min) signed with `STREAM_TOKEN_SECRET`, claims: `{ sub: user.id, track_id, exp, scope: 'stream' }`.
4. Rewrite each `#EXT-X-KEY:METHOD=AES-128,URI="..."` line so `URI` points at `https://synthcamp.net/api/tracks/<id>/key?token=<jwt>`.
5. Return the rewritten manifest with `Content-Type: application/x-mpegURL`, `Cache-Control: no-store`.

Segment URLs in the rewritten manifest can stay as direct R2 public URLs — segments are AES-128 encrypted, so URL secrecy is not the protection layer; possession of the key is. (If we ever want to rate-limit segment delivery, we'd swap to signed segment URLs too, but it's out of scope for phase 3.)

**Key endpoint** (`GET /api/tracks/:id/key`) accepts both:

- `Authorization: Bearer <jwt>` header → hls.js path (Chrome / Firefox / desktop Safari with hls.js).
- `?token=<jwt>` query string → iOS native path. JWT must be unexpired and scoped to this `track_id`.

JWT expiry of 5 min is generous for a 4-min track. If a track somehow exceeds the JWT life, the player's next key fetch fails and we accept the user re-loads. Refresh-on-near-expiry is a phase 4 nice-to-have.

## 8. UI flows

### 8.1 Artist — wizard step 2 (Tracks) gains preview controls

Per uploaded track, a small panel:
- Toggle **Allow 30 s preview** (default ON)
- If ON: timeline scrubber to pick the start position. Preview the chosen 30 s in-page using `<audio>`. Default 0s. Slider PATCHes `tracks.preview_start_seconds` debounced 500 ms after the user stops dragging (see §6).
- Saving the field PATCHes `tracks.preview_start_seconds` and enqueues a `kind='preview'` re-encode if the track was already encoded.

**Encode status surface and recovery.** Each track row shows its `encode_status`:

- `pending` / `encoding` → spinner + "Processing audio…".
- `ready` → green checkmark.
- `failed` → red banner with two buttons:
  - **Retry encoding** → POST `/api/tracks/:id/reencode` enqueues a fresh full+preview job, sets `encode_status='pending'`.
  - **Replace audio** → re-opens the file picker, runs the existing upload flow, which on success triggers a fresh encode via the existing trigger.

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

**Buy-CTA gating on payout-readiness.** When the artist's `profiles_stripe.payout_enabled = false`, the Buy CTA renders disabled with a tooltip: *"Artist hasn't completed payout setup yet."* This prevents charges to a Connect account that can't actually receive payouts.

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
| Track replaced (PATCH audio_source_key) | Both full HLS and preview re-encode; encoder writes new segments under a fresh path prefix tied to the new `aes_key_id`. Old prefix scheduled for deletion via R2 lifecycle rule (24 h grace) so any in-flight playback finishes uninterrupted. Lifecycle rule is platform-level R2 config, not per-track work. |

## 10. Migration list (in deploy order)

1. `20260426000001_purchases.sql` — purchases table + partial unique index + RLS (§4.6)
2. `20260426000002_encode_jobs.sql` — jobs queue + RLS (no policies = service-role only) + `claim_next_encode_job()` SECURITY DEFINER RPC (§6)
3. `20260426000003_stripe_events.sql` — webhook ledger + RLS (no policies)
4. `20260426000004_tracks_drm_columns.sql` — `preview_enabled`, `preview_start_seconds`, `encode_status`, `preview_window_in_bounds` constraint. Does NOT re-add `aes_key_id`, `hls_manifest_key`, `audio_source_key`, or `preview_url` (already in phase 2; see §4 deltas).
5. `20260426000005_releases_party_discount.sql` — `party_live_discount_pct` column
6. `20260426000006_tracks_select_purchaser.sql` — drop + recreate `tracks_select_via_release` policy with the purchaser branch (§4.6)
7. `20260426000007_purchase_rpcs.sql` — `effective_min_price()`, `is_release_purchasable()`, `record_purchase()` SECURITY DEFINER helpers
8. `20260426000008_track_encode_trigger.sql` — trigger on `tracks` insert/update enqueues encode jobs and collapses stale pending preview jobs (§6)

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

Revised from initial 5.5 dev-days after code review surfaced iOS native HLS signing, atomic-claim RPC, refund flow, and tighter party-listener auth.

- Schema migrations + RPCs (`claim_next_encode_job`, purchase helpers, RLS rewrite): ~0.5 day
- Encoder worker (boilerplate + FFmpeg pipeline + R2 streaming + atomic claim wiring + collapse logic): ~2.5 days
- Stripe Checkout + Connect refresh + webhook handler with raw-body signature verification + idempotency + Tax gate: ~1.5 days
- iOS manifest signing + hls.js wiring + key endpoint with dual auth: ~1.5 days
- UI: artist preview controls + retry/replace + buy CTAs + library + payouts dashboard: ~1.5 days
- Tests + smoke (Stripe test-mode, native iOS playback) + ops doc: ~1 day

**Total ≈ 8–9 dev-days.**
