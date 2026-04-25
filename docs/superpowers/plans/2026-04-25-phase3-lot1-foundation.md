# Phase 3 Lot 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all DB migrations, RPCs, RLS policies, and TypeScript helpers required by the Stripe paywall + DRM streaming features. After this lot, the schema is Phase 3-ready but no UI/Stripe/encoder code exists yet.

**Architecture:** Pure DB + TS layer. Replaces the phase 2 stub `purchases` table with the production shape, adds `encode_jobs` queue + `stripe_events` ledger, layers preview/encode columns on `tracks` and party-discount on `releases`, adds RPCs for atomic encode-job claim and pricing helpers. Backfills existing-track encode status. Rewrites `get_editors_choice` against the new column names.

**Tech Stack:** PostgreSQL 16 (self-hosted Supabase), TypeScript helpers in `lib/`.

**Out of scope (next lots):**
- Encoder worker (Lot 2)
- Stripe Checkout + webhook (Lot 3) — the spec's migration #7 with `effective_min_price()`, `is_release_purchasable()`, `record_purchase()` SECURITY DEFINER RPCs ships with Lot 3, not Lot 1, since they're only consumed by the webhook handler.
- Key delivery + player (Lot 4)
- UI (Lot 5)
- Tests + ops (Lot 6)

---

## Reference

- Spec: `docs/superpowers/specs/2026-04-25-phase3-paywall-drm-design.md` (commit `4ddc390`)
- Existing phase 2 stub being replaced: `supabase/migrations/20260422000008_purchases.sql`
- Existing RPC being rewritten: `supabase/migrations/20260422000011_rpc_editors_choice.sql`
- Track schema: `supabase/migrations/20260422000005_tracks.sql` + `20260423000001_tracks_preview_url.sql`

---

## Task 1: Replace `purchases` table

**Files:**
- Create: `supabase/migrations/20260426000001_purchases.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — production purchases table.
--
-- Replaces the phase 2 stub `purchases` table (which had `amount_paid numeric`,
-- `purchased_at`, no status, no platform_fee/artist_payout split). Phase 2 left
-- it empty; this migration drops it and creates the production shape with cents
-- columns, status state machine, tip computation, and Stripe ID columns.
--
-- The existing get_editors_choice() RPC referenced the dropped columns; we
-- rewrite it against the new schema in the same migration so the homepage
-- stops 500ing at deploy time.

DROP TABLE IF EXISTS public.purchases CASCADE;

CREATE TABLE IF NOT EXISTS public.purchases (
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

-- One non-refunded purchase per release per buyer. Refunded buyers can repurchase.
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_one_per_buyer_release
  ON public.purchases (buyer_id, release_id)
  WHERE status != 'refunded';

CREATE INDEX IF NOT EXISTS idx_purchases_artist
  ON public.purchases (artist_id, succeeded_at DESC)
  WHERE status = 'succeeded';

CREATE INDEX IF NOT EXISTS idx_purchases_release
  ON public.purchases (release_id, succeeded_at DESC)
  WHERE status = 'succeeded';

-- Rewrite get_editors_choice against the new column names. PL/pgSQL bodies
-- aren't validated at CREATE time, so the original would persist with stale
-- references; replace it explicitly here.
CREATE OR REPLACE FUNCTION public.get_editors_choice()
RETURNS TABLE (
  release_id uuid,
  revenue_30d numeric,
  is_fallback boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  top_record record;
BEGIN
  SELECT r.id AS id,
         COALESCE(SUM(p.amount_paid_cents), 0)::numeric / 100 AS rev,
         r.created_at AS created_at
  INTO top_record
  FROM public.releases r
  LEFT JOIN public.purchases p ON p.release_id = r.id
    AND p.status = 'succeeded'
    AND p.succeeded_at >= now() - interval '30 days'
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY r.id, r.created_at
  HAVING COALESCE(SUM(p.amount_paid_cents), 0) > 0
  ORDER BY rev DESC, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT top_record.id, top_record.rev, false;
  ELSE
    RETURN QUERY
    SELECT r.id, 0::numeric, true
    FROM public.releases r
    WHERE r.status = 'published' AND r.is_listed = true
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_editors_choice() TO anon, authenticated;
```

- [ ] **Step 2: Lint via psql parse-only locally if possible** (skip if not available — agent verifies syntax via Postgres docs)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260426000001_purchases.sql
git commit -m "phase3(db): replace purchases stub with cents+status schema, rewrite editors_choice"
```

---

## Task 2: `encode_jobs` table + atomic claim RPC

**Files:**
- Create: `supabase/migrations/20260426000002_encode_jobs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — encode_jobs table + atomic claim RPC.
--
-- The encoder worker polls this every 5s. The RPC performs SELECT … FOR
-- UPDATE SKIP LOCKED + UPDATE in a single SECURITY DEFINER call, so two
-- concurrent workers never claim the same job. Worker calls the RPC via
-- service-role client; no direct INSERT/SELECT permissions are granted.

CREATE TABLE IF NOT EXISTS public.encode_jobs (
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

CREATE INDEX IF NOT EXISTS idx_encode_jobs_pending
  ON public.encode_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_encode_jobs_track
  ON public.encode_jobs (track_id, kind, status);

ALTER TABLE public.encode_jobs ENABLE ROW LEVEL SECURITY;
-- No policies. Service-role bypasses RLS; everyone else sees nothing.

-- Atomic claim. Returns the claimed row's id + track_id + kind so the worker
-- can fetch the track row separately if it needs the audio_source_key, etc.
CREATE OR REPLACE FUNCTION public.claim_next_encode_job()
RETURNS TABLE (
  job_id uuid,
  track_id uuid,
  kind text,
  attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed record;
BEGIN
  UPDATE public.encode_jobs ej
  SET status = 'running',
      claimed_at = now(),
      attempts = ej.attempts + 1
  WHERE ej.id = (
    SELECT id FROM public.encode_jobs
    WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING ej.id, ej.track_id, ej.kind, ej.attempts INTO claimed;

  IF FOUND THEN
    RETURN QUERY SELECT claimed.id, claimed.track_id, claimed.kind, claimed.attempts;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_encode_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_encode_job() TO service_role;

-- Helper to mark a job done. Service-role only.
CREATE OR REPLACE FUNCTION public.mark_encode_job_done(
  p_job_id uuid,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'Invalid terminal status: %', p_status;
  END IF;
  UPDATE public.encode_jobs
  SET status = p_status,
      last_error = p_error,
      finished_at = now()
  WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_encode_job_done(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_encode_job_done(uuid, text, text) TO service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000002_encode_jobs.sql
git commit -m "phase3(db): encode_jobs table + claim/mark RPCs (service-role only)"
```

---

## Task 3: `stripe_events` ledger

**Files:**
- Create: `supabase/migrations/20260426000003_stripe_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — Stripe webhook event ledger for idempotency.
--
-- Every webhook hit inserts the evt_id first; if it's a duplicate (Stripe
-- retries), the unique-violation tells the handler to no-op. Stored payload
-- aids debugging. Service-role only — clients never see this table.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,  -- evt_xxx from Stripe
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_unprocessed
  ON public.stripe_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies. Service-role only.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000003_stripe_events.sql
git commit -m "phase3(db): stripe_events ledger for webhook idempotency"
```

---

## Task 4: `tracks` + `releases` ALTERs + backfill

**Files:**
- Create: `supabase/migrations/20260426000004_tracks_drm_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — DRM/preview columns on tracks + party-live discount on releases.

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS preview_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preview_start_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encode_status text NOT NULL DEFAULT 'pending'
    CHECK (encode_status IN ('pending', 'encoding', 'ready', 'failed'));

-- Backfill: tracks that already have hls_manifest_key set (phase 2 uploads
-- that completed encoding through any prior pipeline) start in 'ready'.
-- Today this matches zero rows in production (the upload route never wrote
-- hls_manifest_key), but the UPDATE is harmless and protects against any
-- future state we haven't anticipated.
UPDATE public.tracks
SET encode_status = 'ready'
WHERE hls_manifest_key IS NOT NULL;

-- Disable preview on any track shorter than 30 seconds before adding the
-- CHECK. Without this, the constraint would reject the migration on
-- short tracks (preview_start_seconds=0 + 30 > duration_seconds<30).
UPDATE public.tracks
SET preview_enabled = false
WHERE duration_seconds < 30;

-- Constraint: either preview is disabled, OR the 30s window fits within
-- the track. CREATE CONSTRAINT has no IF NOT EXISTS, so guard with DO.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'preview_window_in_bounds'
  ) THEN
    ALTER TABLE public.tracks
      ADD CONSTRAINT preview_window_in_bounds
        CHECK (preview_enabled = false OR preview_start_seconds + 30 <= duration_seconds);
  END IF;
END $$;

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS party_live_discount_pct int NOT NULL DEFAULT 20
    CHECK (party_live_discount_pct BETWEEN 0 AND 50);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000004_tracks_drm_columns.sql
git commit -m "phase3(db): preview controls + encode_status on tracks, party discount on releases"
```

---

## Task 5: RLS for `purchases` + extend tracks RLS for purchasers

**Files:**
- Create: `supabase/migrations/20260426000005_purchases_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — RLS for purchases table + extend tracks RLS for buyers.
--
-- Buyer can read their own purchase row (for /explore/library + receipt).
-- Artist can read purchases of their own releases (for sales reporting).
-- Admin can read everything (for support / audit).
-- INSERT/UPDATE/DELETE are service-role only — Stripe webhook owns writes,
-- never the client.

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS, so drop-then-create for idempotency.
DROP POLICY IF EXISTS purchases_select_buyer ON public.purchases;
CREATE POLICY purchases_select_buyer ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS purchases_select_artist ON public.purchases;
CREATE POLICY purchases_select_artist ON public.purchases FOR SELECT
  USING (auth.uid() = artist_id);

DROP POLICY IF EXISTS purchases_select_admin ON public.purchases;
CREATE POLICY purchases_select_admin ON public.purchases FOR SELECT
  USING (public.is_current_user_admin());

-- No INSERT/UPDATE/DELETE policies → all client mutations denied. Service
-- role bypasses RLS, used by the webhook handler.

-- Extend tracks_select_via_release so a buyer of an archived release still
-- streams. Phase 2 policy hid the track once the release was archived; that
-- breaks the lifetime-access guarantee for purchasers. Drop and recreate.
DROP POLICY IF EXISTS tracks_select_via_release ON public.tracks;

CREATE POLICY tracks_select_via_release ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = tracks.release_id
        AND (
          -- Public catalog visibility (unchanged from phase 2)
          r.status IN ('published', 'unlisted', 'scheduled')
          -- Owner sees their own (unchanged)
          OR r.artist_id = auth.uid()
          -- Admin sees everything
          OR public.is_current_user_admin()
          -- Phase 3 addition: buyers retain access even after archive
          OR EXISTS (
            SELECT 1 FROM public.purchases p
            WHERE p.release_id = r.id
              AND p.buyer_id = auth.uid()
              AND p.status = 'succeeded'
          )
        )
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000005_purchases_rls.sql
git commit -m "phase3(db): RLS on purchases (buyer/artist/admin read), extend tracks for buyers"
```

---

## Task 6: Pricing helper extension

**Files:**
- Modify: `lib/pricing.ts`
- Test: `tests/lib/pricing.test.ts`

- [ ] **Step 1: Read the existing file** to know what's there

- [ ] **Step 2: Add the `effectiveMinPrice` helper**

Append to `lib/pricing.ts`:

```ts
/**
 * Effective minimum price for a release, applying the party-live discount
 * when the caller hands us `isPartyLive=true`. Returns dollars (string with
 * 2 decimals, matching getPrice's contract).
 *
 * Server callers must compute `isPartyLive` from the DB (an active party
 * with status='live' for the release). Client-rendered prices are
 * informational; the authoritative price is enforced server-side at
 * Checkout Session creation time (see Phase 3 Lot 3).
 */
export function effectiveMinPrice(
  trackCount: number,
  partyLiveDiscountPct: number,
  isPartyLive: boolean,
): string {
  const base = parseFloat(getPrice(trackCount));
  if (!isPartyLive || partyLiveDiscountPct === 0) return base.toFixed(2);
  const discounted = base * (1 - partyLiveDiscountPct / 100);
  return discounted.toFixed(2);
}
```

- [ ] **Step 3: Add tests**

Append to `tests/lib/pricing.test.ts`. **Match the existing file's conventions** — read it first to confirm. Existing file uses `import { describe, it, expect } from 'vitest'` and `it(...)` (not `test(...)`), with `@/lib/pricing` import alias.

```ts
// Append at the end of the existing file. Don't duplicate imports if the
// describe is added inside the same block; if added as a sibling describe
// at top level, the imports are already in scope.

describe('effectiveMinPrice', () => {
  it('returns base price when party is not live', () => {
    expect(effectiveMinPrice(3, 20, false)).toBe(getPrice(3));
  });

  it('applies 20% discount on 3-track EP during party live', () => {
    // getPrice(3) = '1.99'; 1.99 * 0.8 = 1.592 → '1.59'
    expect(effectiveMinPrice(3, 20, true)).toBe('1.59');
  });

  it('returns base when discount is 0%', () => {
    expect(effectiveMinPrice(5, 0, true)).toBe(getPrice(5));
  });

  it('caps cleanly at 50% discount', () => {
    // getPrice(12) = '7.99'; 7.99 * 0.5 = 3.995 → '4.00' (rounding)
    expect(effectiveMinPrice(12, 50, true)).toBe('4.00');
  });
});
```

If `effectiveMinPrice` isn't already imported at the top of the file, add it: `import { effectiveMinPrice, getPrice } from '@/lib/pricing'`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/pricing.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts tests/lib/pricing.test.ts
git commit -m "phase3(lib): effectiveMinPrice with party-live discount + tests"
```

---

## Task 7: Track encode trigger

**Files:**
- Create: `supabase/migrations/20260426000006_track_encode_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 — auto-enqueue encode jobs on track audio_source_key set.
--
-- On INSERT (new track) and on UPDATE OF audio_source_key (artist replaced
-- the audio after a failed encode), enqueue a 'full' job. On UPDATE OF
-- preview_start_seconds (artist scrubbed the timeline), enqueue only a
-- 'preview' job and collapse stale pending preview jobs for the same track.

CREATE OR REPLACE FUNCTION public.enqueue_track_encode_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New audio source → re-encode everything. encode_status defaults to
  -- 'pending' on the new row already; no extra UPDATE needed.
  IF TG_OP = 'INSERT' AND NEW.audio_source_key IS NOT NULL THEN
    INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'full');
    INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Audio replaced → full re-encode.
    IF NEW.audio_source_key IS DISTINCT FROM OLD.audio_source_key
       AND NEW.audio_source_key IS NOT NULL THEN
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'full');
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
      UPDATE public.tracks SET encode_status = 'pending' WHERE id = NEW.id;
      RETURN NEW;
    END IF;

    -- Preview window changed → preview-only re-encode, collapse stale jobs.
    IF NEW.preview_start_seconds IS DISTINCT FROM OLD.preview_start_seconds
       OR NEW.preview_enabled IS DISTINCT FROM OLD.preview_enabled THEN
      DELETE FROM public.encode_jobs
      WHERE track_id = NEW.id
        AND kind = 'preview'
        AND status = 'pending';
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tracks_enqueue_encode ON public.tracks;
CREATE TRIGGER trg_tracks_enqueue_encode
  AFTER INSERT OR UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_track_encode_jobs();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000006_track_encode_trigger.sql
git commit -m "phase3(db): trigger enqueues full+preview encode jobs on track audio change"
```

---

## Task 8: Regenerate `lib/database.types.ts`

**Files:**
- Modify: `lib/database.types.ts`

- [ ] **Step 1: Manually update the types**

Since we don't run `supabase gen types` against the local schema (production is self-hosted), update `lib/database.types.ts` by hand to reflect:

1. **Replace the existing `purchases` Row/Insert/Update** with the new column shape (cents columns + status + Stripe fields + party_discount_applied).
2. **Add `encode_jobs` and `stripe_events` table types**.
3. **Add new columns** on `tracks`: `preview_enabled`, `preview_start_seconds`, `encode_status` (typed as `'pending' | 'encoding' | 'ready' | 'failed'`).
4. **Add column** on `releases`: `party_live_discount_pct: number`.
5. **Add new RPCs** to the `Functions` block: `claim_next_encode_job`, `mark_encode_job_done`. The existing `get_editors_choice` keeps the same signature so no change needed there.

Use the existing structure as a model. Read other table definitions (e.g. `notifications`, `follows`) to match the typing convention exactly.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If references to old `purchases.amount_paid` / `purchased_at` fail to compile anywhere in the codebase, fix the call sites (likely none — the phase 2 stub was unused).

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "phase3(types): regenerate database.types.ts for phase 3 schema"
```

---

## Task 9: Push and apply on VPS

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Apply on VPS** (manual, runs after push)

```bash
ssh root@<vps>
cd /opt/synthcamp
git pull
bash scripts/apply-migrations.sh
```

Expected output: 6 new migrations applied (`20260426000001` through `20260426000006`), no errors.

If any migration fails: read the error, decide whether to patch the migration file or roll forward with a new fix migration. Do NOT manually mutate the DB.

- [ ] **Step 3: Sanity check**

On the VPS:

```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "\d purchases"
docker exec -it supabase-db psql -U postgres -d postgres -c "\d encode_jobs"
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname IN ('get_editors_choice', 'claim_next_encode_job', 'mark_encode_job_done', 'enqueue_track_encode_jobs');"
```

Expected: all tables show the new shape; all 4 functions present.

- [ ] **Step 4: Smoke test homepage**

`curl https://synthcamp.net/explore/home` should return 200 and contain a hero release. Confirms `get_editors_choice()` runs without error against the new schema.

---

## Lot 1 done when:

- All 6 migrations applied cleanly on VPS.
- `npx tsc --noEmit` clean locally.
- `npx vitest run` passes (pricing tests included).
- Homepage loads in production.
- No new application code yet; encoder/Stripe/UI/tests come in Lots 2–6.

## What's NOT done yet (next lots):

- Encoder worker (Lot 2)
- Stripe Checkout + webhook (Lot 3)
- Manifest/key endpoints + player wiring (Lot 4)
- Artist preview UI + Buy CTA + payouts dashboard (Lot 5)
- E2E + smoke tests (Lot 6)
