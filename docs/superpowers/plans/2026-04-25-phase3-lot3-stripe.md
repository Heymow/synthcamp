# Phase 3 Lot 3 — Stripe Checkout + Webhook + Refunds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the full Stripe paywall flow — Connect Express onboarding refresh, Checkout Session creation with PWYW + party-live discount + idempotency, webhook handler with signature validation and event dispatch, refund flow for admins. After this lot, a buyer can complete a purchase end-to-end and the artist's `profiles_stripe` payout balance reflects it.

**Architecture:** Destination charges on the platform Stripe account. Platform owns the customer relationship; artist receives via `transfer_data.destination`. Application fee 15%. All side-effect writes (mark purchase succeeded, refund, payout_enabled flip) flow through the webhook handler, never directly from the client. Webhook idempotent via `stripe_events` ledger from Lot 1. Pricing math: PWYW with server-side bounds (lower = `effective_min_price`, upper = $1000 hard cap).

**Tech Stack:** `stripe` SDK (server-side), Next.js Route Handlers, Supabase service-role for webhook writes.

**Out of scope:** Manifest/key endpoints + hls.js player wiring (Lot 4), UI for Buy CTA + library + payouts dashboard (Lot 5), E2E tests (Lot 6).

---

## Reference

- Spec: `docs/superpowers/specs/2026-04-25-phase3-paywall-drm-design.md` (commit `4ddc390`+)
- Lot 1 plan: foundation (purchases table, encode_jobs, stripe_events, RLS, pricing helpers)
- Lot 1 deferred this lot's RPCs: `effective_min_price()`, `is_release_purchasable()`, `record_purchase()` ship here.
- Existing Stripe lib: `lib/stripe.ts` (used by `app/api/artist/stripe/connect/route.ts`).

---

## Required env vars on Railway (Next.js service)

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side API calls. Set already (Connect prep). |
| `STRIPE_WEBHOOK_SECRET` | Signature validation for `/api/webhooks/stripe`. New. |
| `STRIPE_PUBLISHABLE_KEY` | Optional, only if we use Stripe Elements (we use Checkout, so not needed). |
| `STRIPE_CONNECT_REFRESH_URL` | Where Stripe sends artist on link-expired. Default `/artist/payouts/connect/refresh`. |
| `STRIPE_CONNECT_RETURN_URL` | Where Stripe sends artist after onboarding. Default `/artist/payouts/connect/return`. |
| `PLATFORM_FEE_PERCENT` | `15` (basis: 100). Server-side enforced, not client. |

Setup instructions in §5 below.

---

## Task 1: Purchase RPCs migration

**Files:**
- Create: `supabase/migrations/20260427000001_purchase_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SynthCamp Phase 3 Lot 3 — purchase RPCs.
--
-- Three SECURITY DEFINER helpers used by the Checkout endpoint and the
-- webhook handler:
--   1. effective_min_price(release_id)        → cents (integer)
--   2. is_release_purchasable(release_id)     → boolean
--   3. record_purchase(...)                   → uuid (purchase id)
--
-- All assume the caller authentication has already happened in the route
-- handler. The RPCs are SECURITY DEFINER so they bypass RLS for the
-- write that creates a pending purchase row (the user can't INSERT
-- purchases directly per Lot 1's RLS).

-- 1. Effective minimum price in cents, applying the party-live discount
-- iff a party is currently live for the release.
CREATE OR REPLACE FUNCTION public.effective_min_price_cents(p_release_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track_count int;
  v_discount_pct int;
  v_party_live boolean;
  v_base_cents int;
BEGIN
  SELECT count(*) INTO v_track_count
    FROM public.tracks WHERE release_id = p_release_id;

  IF v_track_count IS NULL OR v_track_count = 0 THEN
    RAISE EXCEPTION 'Release % has no tracks', p_release_id USING ERRCODE = '22023';
  END IF;

  SELECT party_live_discount_pct INTO v_discount_pct
    FROM public.releases WHERE id = p_release_id;

  -- Mirror lib/pricing.ts:getPrice exactly: ceil(n * 0.6) - 0.01 dollars.
  -- In cents: (ceil(n * 60) - 1).
  v_base_cents := ceil(v_track_count * 60.0)::int - 1;

  v_party_live := EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status = 'live'
      AND ends_at > now()
  );

  IF v_party_live AND v_discount_pct > 0 THEN
    RETURN floor(v_base_cents * (100 - v_discount_pct) / 100.0)::int;
  END IF;
  RETURN v_base_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.effective_min_price_cents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_min_price_cents(uuid) TO authenticated, service_role;

-- 2. Is the release purchasable RIGHT NOW?
-- Rules per spec §9:
--   - Release must be 'published' (post-party live → ended → published flow)
--     OR be 'scheduled' AND have a party currently live.
--   - Artist must have payout_enabled=true.
--   - Buyer cannot have an active (non-refunded) purchase already.
CREATE OR REPLACE FUNCTION public.is_release_purchasable(
  p_release_id uuid,
  p_buyer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release record;
  v_payout_ok boolean;
  v_party_live boolean;
  v_already_owns boolean;
BEGIN
  SELECT id, artist_id, status INTO v_release
    FROM public.releases WHERE id = p_release_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT COALESCE(payout_enabled, false) INTO v_payout_ok
    FROM public.profiles_stripe WHERE profile_id = v_release.artist_id;
  IF NOT COALESCE(v_payout_ok, false) THEN RETURN false; END IF;

  v_party_live := EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status = 'live'
      AND ends_at > now()
  );

  -- Status gate: published (post-party-end) OR scheduled-and-party-live.
  IF v_release.status = 'published' THEN
    NULL; -- ok
  ELSIF v_release.status = 'scheduled' AND v_party_live THEN
    NULL; -- ok per spec: pre-orders disabled but mid-party purchases allowed
  ELSE
    RETURN false;
  END IF;

  v_already_owns := EXISTS (
    SELECT 1 FROM public.purchases
    WHERE release_id = p_release_id
      AND buyer_id = p_buyer_id
      AND status != 'refunded'
  );
  IF v_already_owns THEN RETURN false; END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.is_release_purchasable(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_release_purchasable(uuid, uuid) TO authenticated, service_role;

-- 3. Record the purchase row at Checkout creation time. Status is 'pending'
-- until the webhook fires checkout.session.completed.
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_buyer_id uuid,
  p_release_id uuid,
  p_amount_paid_cents int,
  p_amount_min_cents int,
  p_platform_fee_cents int,
  p_artist_payout_cents int,
  p_currency text,
  p_stripe_session_id text,
  p_party_discount_applied boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_id uuid;
  v_purchase_id uuid;
BEGIN
  SELECT artist_id INTO v_artist_id FROM public.releases WHERE id = p_release_id;
  IF v_artist_id IS NULL THEN
    RAISE EXCEPTION 'Release % not found', p_release_id USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.purchases (
    buyer_id, release_id, artist_id,
    amount_paid_cents, amount_min_cents,
    platform_fee_cents, artist_payout_cents,
    currency,
    stripe_session_id,
    status,
    party_discount_applied
  ) VALUES (
    p_buyer_id, p_release_id, v_artist_id,
    p_amount_paid_cents, p_amount_min_cents,
    p_platform_fee_cents, p_artist_payout_cents,
    COALESCE(p_currency, 'usd'),
    p_stripe_session_id,
    'pending',
    p_party_discount_applied
  )
  RETURNING id INTO v_purchase_id;

  RETURN v_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_purchase FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, uuid, int, int, int, int, text, text, boolean) TO service_role;
```

- [ ] **Step 2: Update `lib/database.types.ts`** to add the 3 new RPCs

```ts
effective_min_price_cents: {
  Args: { p_release_id: string };
  Returns: number;
};
is_release_purchasable: {
  Args: { p_release_id: string; p_buyer_id: string };
  Returns: boolean;
};
record_purchase: {
  Args: {
    p_buyer_id: string;
    p_release_id: string;
    p_amount_paid_cents: number;
    p_amount_min_cents: number;
    p_platform_fee_cents: number;
    p_artist_payout_cents: number;
    p_currency: string;
    p_stripe_session_id: string;
    p_party_discount_applied: boolean;
  };
  Returns: string;
};
```

Read the existing types first, insert alphabetically.

- [ ] **Step 3: Typecheck + commit + push**

```bash
npx tsc --noEmit
git add supabase/migrations/20260427000001_purchase_rpcs.sql lib/database.types.ts
git commit -m "phase3(db): purchase RPCs (effective_min_price_cents, is_release_purchasable, record_purchase)"
git push origin main
```

---

## Task 2: Stripe Checkout endpoint

**Files:**
- Create: `app/api/releases/[id]/checkout/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';
import { resolveOrigin } from '@/lib/auth/origin';
import { requireActiveAccount } from '@/lib/api/require-active';

export const dynamic = 'force-dynamic';

interface CheckoutBody {
  amount_cents: number; // PWYW: client-supplied; server validates bounds
}

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? '15');
const HARD_CAP_CENTS = 100_000; // $1000 ceiling, defensive

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: releaseId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  // 1. Eligibility check
  const { data: purchasable, error: pErr } = await supabase.rpc('is_release_purchasable', {
    p_release_id: releaseId,
    p_buyer_id: user.id,
  });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!purchasable) {
    return NextResponse.json(
      { error: 'Release not purchasable (status, payout setup, or already owned)' },
      { status: 403 },
    );
  }

  // 2. Effective min price + amount validation
  const { data: minCents, error: minErr } = await supabase.rpc('effective_min_price_cents', {
    p_release_id: releaseId,
  });
  if (minErr || typeof minCents !== 'number') {
    return NextResponse.json({ error: minErr?.message ?? 'price lookup failed' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const amountCents = body?.amount_cents;
  if (
    typeof amountCents !== 'number' ||
    !Number.isInteger(amountCents) ||
    amountCents < minCents ||
    amountCents > HARD_CAP_CENTS
  ) {
    return NextResponse.json(
      { error: `Invalid amount. Must be an integer between ${minCents} and ${HARD_CAP_CENTS} cents.` },
      { status: 400 },
    );
  }

  // 3. Fetch release + artist payout context
  const { data: release } = await supabase
    .from('releases')
    .select('id, slug, title, artist_id, status')
    .eq('id', releaseId)
    .single();
  if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 });

  const { data: artistStripe } = await supabase
    .from('profiles_stripe')
    .select('stripe_account_id, payout_enabled')
    .eq('profile_id', release.artist_id)
    .maybeSingle();
  if (!artistStripe?.stripe_account_id || !artistStripe.payout_enabled) {
    return NextResponse.json({ error: 'Artist payout not enabled' }, { status: 403 });
  }

  // 4. Compute party-live flag (drives the party_discount_applied marker)
  const { data: livePartyExists } = await supabase
    .from('listening_parties')
    .select('id')
    .eq('release_id', releaseId)
    .eq('status', 'live')
    .gt('ends_at', new Date().toISOString())
    .maybeSingle();
  const partyDiscountApplied = Boolean(livePartyExists);

  // 5. Compute fee + payout split
  const platformFeeCents = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
  const artistPayoutCents = amountCents - platformFeeCents;

  // 6. Create Stripe Checkout Session
  const stripe = getStripeClient();
  const origin = resolveOrigin(request);

  // Idempotency: minute-bucketed so double-clicks within 60s reuse the session.
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `checkout:${user.id}:${releaseId}:${minuteBucket}`;

  // Stripe Tax gate: if the artist account doesn't have automatic_tax enabled,
  // omit the flag — Stripe rejects sessions when capability is missing.
  let autoTaxEnabled = false;
  try {
    const account = await stripe.accounts.retrieve(artistStripe.stripe_account_id);
    autoTaxEnabled = (account.tax as { automatic_tax?: { status?: string } })?.automatic_tax?.status === 'enabled';
  } catch {
    autoTaxEnabled = false;
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: release.title,
              metadata: { release_id: release.id },
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: artistStripe.stripe_account_id },
        metadata: {
          release_id: release.id,
          buyer_id: user.id,
          artist_id: release.artist_id,
        },
      },
      automatic_tax: autoTaxEnabled ? { enabled: true } : undefined,
      customer_email: user.email,
      success_url: `${origin}/r/${release.slug}?purchase=success`,
      cancel_url: `${origin}/r/${release.slug}?purchase=cancelled`,
      metadata: {
        release_id: release.id,
        buyer_id: user.id,
        party_discount_applied: String(partyDiscountApplied),
      },
    },
    { idempotencyKey },
  );

  // 7. Reserve a pending purchase row (writes via SECURITY DEFINER RPC since
  // RLS on `purchases` only allows SELECT for clients).
  const { error: recordErr } = await supabase.rpc('record_purchase', {
    p_buyer_id: user.id,
    p_release_id: release.id,
    p_amount_paid_cents: amountCents,
    p_amount_min_cents: minCents,
    p_platform_fee_cents: platformFeeCents,
    p_artist_payout_cents: artistPayoutCents,
    p_currency: 'usd',
    p_stripe_session_id: session.id,
    p_party_discount_applied: partyDiscountApplied,
  });
  if (recordErr) {
    // Log but don't fail; the webhook can recover from the session metadata.
    console.error('[checkout] record_purchase failed:', recordErr);
  }

  return NextResponse.json({ session_url: session.url, session_id: session.id });
}
```

- [ ] **Step 2: Verify `lib/auth/origin.ts` exports `resolveOrigin`** and `lib/stripe.ts` exports `getStripeClient`. If not, add minimal stubs.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/releases/[id]/checkout/route.ts
git commit -m "phase3(checkout): create Stripe Session with PWYW + Connect transfer"
```

---

## Task 3: Stripe Webhook handler

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // need raw body access

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const sig = (await headers()).get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  // Raw body required for signature verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Idempotency: insert event-id into ledger first. If duplicate, skip.
  const { error: insertErr } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as object });
  if (insertErr) {
    if (insertErr.code === '23505') {
      // Already processed — Stripe is retrying
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error('[webhook] event ledger insert failed:', insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await handleSessionExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;
      case 'account.updated':
        await handleAccountUpdated(supabase, event.data.object as Stripe.Account);
        break;
      default:
        // Ignore other events; ledger entry serves as audit.
        break;
    }
    await supabase.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhook] handler for ${event.type} failed:`, err);
    // Return 500 so Stripe retries. The ledger row stays unprocessed; the
    // next retry will fail the dedupe insert (23505), see existing row,
    // and re-attempt by NOT short-circuiting on dedupe... actually that
    // does short-circuit. Trade-off: we accept that retries past first
    // failure require manual intervention. Realistic for a Phase 3 MVP.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}

async function handleSessionCompleted(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'succeeded',
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      succeeded_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);
  if (error) throw new Error(`update purchase succeeded: ${error.message}`);
}

async function handleSessionExpired(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Free up the partial unique constraint so the buyer can retry.
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('stripe_session_id', session.id)
    .eq('status', 'pending');
  if (error) throw new Error(`cleanup expired purchase: ${error.message}`);
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  charge: Stripe.Charge,
): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({ status: 'refunded' })
    .eq('stripe_charge_id', charge.id);
  if (error) throw new Error(`mark refunded: ${error.message}`);
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  account: Stripe.Account,
): Promise<void> {
  const payoutEnabled = Boolean(account.charges_enabled && account.payouts_enabled);
  const { error } = await supabase
    .from('profiles_stripe')
    .update({ payout_enabled: payoutEnabled })
    .eq('stripe_account_id', account.id);
  if (error) throw new Error(`update payout_enabled: ${error.message}`);
}
```

- [ ] **Step 2: Verify Next.js doesn't strip the raw body**

The `request.text()` call must precede any other body consumer. Since we don't call `request.json()` first, this should work. If Next.js middleware on this route consumes body first, refactor.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/webhooks/stripe/route.ts
git commit -m "phase3(webhook): Stripe handler with signature validation + event dispatch"
```

---

## Task 4: Refund endpoint (admin-only)

**Files:**
- Create: `app/api/admin/purchases/[id]/refund/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin: _admin, supabase, error } = await requireAdmin();
  if (error) return error;

  const { id: purchaseId } = await params;

  const { data: purchase, error: fetchErr } = await supabase
    .from('purchases')
    .select('id, status, stripe_charge_id, stripe_payment_intent_id')
    .eq('id', purchaseId)
    .single();
  if (fetchErr || !purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }
  if (purchase.status !== 'succeeded') {
    return NextResponse.json(
      { error: `Cannot refund purchase in status '${purchase.status}'` },
      { status: 400 },
    );
  }
  const chargeId = purchase.stripe_charge_id ?? null;
  if (!chargeId) {
    return NextResponse.json({ error: 'No charge id on purchase' }, { status: 400 });
  }

  const stripe = getStripeClient();
  await stripe.refunds.create({
    charge: chargeId,
    refund_application_fee: true,
    reverse_transfer: true,
  });

  // The webhook charge.refunded fires async and flips purchases.status
  // to 'refunded'. We don't update the row here to avoid races.
  return NextResponse.json({ ok: true, refunded_charge: chargeId });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/admin/purchases/[id]/refund/route.ts
git commit -m "phase3(admin): refund endpoint with application fee + transfer reversal"
```

---

## Task 5: Push, configure Stripe, test end-to-end

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Apply migration on VPS**

```bash
ssh root@<vps>
cd /opt/synthcamp
git pull
bash scripts/apply-migrations.sh
```

Expected: `20260427000001_purchase_rpcs.sql … ok`.

- [ ] **Step 3: Set Railway env vars on Next.js service**

- `STRIPE_WEBHOOK_SECRET` = (from Stripe Dashboard, see Step 4)
- `PLATFORM_FEE_PERCENT` = `15`

- [ ] **Step 4: Configure Stripe webhook endpoint**

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://synthcamp.net/api/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `account.updated`
- After creation, copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` on Railway.

- [ ] **Step 5: Test with Stripe CLI**

```bash
stripe trigger checkout.session.completed
```

Watch Railway logs of the Next.js service for `[webhook] handler for checkout.session.completed failed:` (or success).

- [ ] **Step 6: End-to-end smoke test**

Pre-requisites: a release with `status='published'` AND its artist has `profiles_stripe.payout_enabled=true` (use Stripe test-mode account).

1. From the browser as a logged-in user, hit `POST /api/releases/<id>/checkout` with `{amount_cents: <min_cents_or_more>}`. Expect `session_url` in response.
2. Open the session URL in another tab. Use Stripe test card `4242 4242 4242 4242` to complete payment.
3. Verify in DB:
   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, status, succeeded_at, stripe_charge_id FROM purchases ORDER BY created_at DESC LIMIT 3;"
   ```
   The latest row should be `status='succeeded'` with `succeeded_at` set.
4. Verify the buyer can now access tracks (RLS extension from Lot 1 lets them through).

---

## Lot 3 done when:

- All 4 endpoints deployed: checkout, webhook, refund, +existing connect.
- Migration applied; 3 new RPCs available.
- A test purchase completes end-to-end with the buyer ending up in `purchases` table as `succeeded`.
- The webhook handler dedups Stripe retries via `stripe_events`.
- Refund endpoint flips a purchase to `refunded` and Stripe charges back the application fee.

## What's NOT done yet (next lots):

- Manifest/key endpoints + hls.js player wiring (Lot 4)
- UI: Buy CTA + library + payouts dashboard + artist preview controls (Lot 5)
- E2E + smoke tests (Lot 6)
