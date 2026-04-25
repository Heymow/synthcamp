# Phase 3 Lot 3 Pivot — Direct Charges + Embedded Onboarding Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the existing Lot 3 Stripe wiring from **destination charges + hosted Account Link onboarding** to **direct charges + embedded onboarding components**. After this pivot, payments are created directly on the artist's connected Stripe account (platform pulls an `application_fee_amount`); refunds and webhook handlers operate against connected accounts via the `stripeAccount` option; and artists onboard inside SynthCamp's UI through `<ConnectAccountOnboarding />` instead of redirecting to Stripe.

**Architecture:**
- **Charge model:** Direct charges. The Checkout Session is created on the connected account (`{ stripeAccount }` API option). `application_fee_amount` flows from the artist's account back to the platform automatically. No `transfer_data.destination` and no platform-side transfer to reverse on refund.
- **Webhook model:** A single endpoint receives both platform events and Connect events. Connect-origin events carry `event.account = acct_...`; any subsequent retrieve calls (`paymentIntents.retrieve`, etc.) MUST pass `{ stripeAccount: event.account }`. Signature secret stays a single `STRIPE_WEBHOOK_SECRET`.
- **Refunds:** `stripe.refunds.create(params, { stripeAccount })`. Drop `reverse_transfer` (no transfer happened); keep `refund_application_fee: true` so the platform fee returns to the artist on refund.
- **Onboarding + management:** Embedded `<ConnectAccountOnboarding />` (initial KYC) and `<ConnectAccountManagement />` (ongoing settings: bank changes, identity updates, payouts view) from `@stripe/react-connect-js`, fed by a server-issued `AccountSession.client_secret` that enables BOTH components. The UI mounts onboarding when `payout_enabled = false`, management when `payout_enabled = true`. The legacy hosted Account Link helper (`createOnboardingLink`) stays in `lib/stripe.ts` as a dormant fallback.

**Tech stack:** `stripe` SDK (already installed `^22.1.0`), `@stripe/connect-js` + `@stripe/react-connect-js` (new), Next.js Route Handlers, Supabase service-role for webhook writes.

**Out of scope:** RPC changes (`record_purchase` is fiscal recording and stays untouched), schema changes to `purchases` / `stripe_events` / `profiles_stripe`, the Buy CTA / library / payouts dashboard UI beyond replacing the Connect button, E2E tests.

---

## Reference

- Original Lot 3 plan: `docs/superpowers/plans/2026-04-25-phase3-lot3-stripe.md`
- Spec: `docs/superpowers/specs/2026-04-25-phase3-paywall-drm-design.md`
- Migration `supabase/migrations/20260427000001_purchase_rpcs.sql` (commit `d19c6b1`) — already applied on VPS, untouched by this pivot.
- Current state of files this plan rewires:
  - `app/api/releases/[id]/checkout/route.ts` (commit `ded41e4`)
  - `app/api/webhooks/stripe/route.ts` (commit `9d36695`)
  - `app/api/admin/purchases/[id]/refund/route.ts` (commit `75eb19f`)
  - `lib/stripe.ts` (commit `5955357`)
  - `components/settings/payouts-card.tsx` (existing hosted-flow CTA, rendered by `app/(main)/settings/profile/page.tsx`)

> **Note on directory layout:** the artist payouts CTA actually lives in `components/settings/payouts-card.tsx` and is mounted from `app/(main)/settings/profile/page.tsx`. This plan targets the real location, not a hypothetical `(artist)` route group.

---

## Required env vars on Railway (Next.js service)

| Var | Purpose | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server-side API calls. | Existing |
| `STRIPE_WEBHOOK_SECRET` | Single signing secret; the same endpoint serves platform + Connect events once "Listen to events on Connected accounts" is toggled on the existing endpoint. | Existing |
| `PLATFORM_FEE_PERCENT` | `15`. Server-side enforced. | Existing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` in test mode, `pk_live_...` in prod. Used by the embedded onboarding component. | **NEW** |

---

## Task 1: Pivot checkout endpoint to direct charges

**Files:**
- Modify: `app/api/releases/[id]/checkout/route.ts`

- [ ] **Step 1: Replace destination-charge wiring with direct-charge wiring**

In `app/api/releases/[id]/checkout/route.ts`, replace the `payment_intent_data` block and the `stripe.checkout.sessions.create(...)` call so the session is created on the connected account.

Diff intent (replace existing destination-charge `payment_intent_data` and the single-arg `create(...)`):

```ts
  // 6. Create Stripe Checkout Session — DIRECT CHARGE on the connected account.
  // The session is created against the artist's account via the second-arg
  // `stripeAccount` option; the platform automatically receives
  // `application_fee_amount` from the resulting charge. No `transfer_data`.
  const stripe = getStripeClient();
  const origin = resolveOrigin(request);

  // Idempotency unchanged — same key shape Lot 3 shipped.
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `checkout:${user.id}:${releaseId}:${amountCents}:${minuteBucket}`;

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
        // Statement descriptor: max 22 chars, alphanumeric + spaces. Card
        // statements show "SYNTHCAMP" so buyers recognise the charge even
        // though the merchant of record is the artist account.
        statement_descriptor: 'SYNTHCAMP',
        metadata: {
          release_id: release.id,
          buyer_id: user.id,
          artist_id: release.artist_id,
        },
      },
      customer_email: user.email,
      success_url: `${origin}/r/${release.slug}?purchase=success`,
      cancel_url: `${origin}/r/${release.slug}?purchase=cancelled`,
      metadata: {
        release_id: release.id,
        buyer_id: user.id,
        party_discount_applied: String(partyDiscountApplied),
      },
    },
    {
      idempotencyKey,
      stripeAccount: artistStripe.stripe_account_id,
    },
  );
```

Removed lines (vs the current `ded41e4` version):
- `transfer_data: { destination: artistStripe.stripe_account_id },` inside `payment_intent_data`.

Added lines:
- `statement_descriptor: 'SYNTHCAMP'` inside `payment_intent_data`.
- `stripeAccount: artistStripe.stripe_account_id` inside the second-arg options object alongside `idempotencyKey`.

Everything else in the route stays identical:
- Auth + `requireActiveAccount`.
- `is_release_purchasable` and `effective_min_price_cents` RPC calls.
- Amount validation (min/HARD_CAP).
- `record_purchase` service-role RPC call (charge-model agnostic — it only stores fiscal numbers and the session id).

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/releases/[id]/checkout/route.ts
git commit -m "phase3(checkout): pivot to direct charges (stripeAccount option)"
```

---

## Task 2: Pivot refund endpoint to direct charges

**Files:**
- Modify: `app/api/admin/purchases/[id]/refund/route.ts`

The refund must now run *on the connected account*. There is no `connected_account_id` column on `purchases` — the join path is:

> `purchases.release_id` → `releases.artist_id` → `profiles_stripe.profile_id` → `profiles_stripe.stripe_account_id`

(Verified against `supabase/migrations/20260425000011_profiles_stripe_account_private.sql` and the existing checkout route which uses the same join.)

- [ ] **Step 1: Fetch the connected account id and pass `stripeAccount`**

Rewrite the route to:
1. Look up the purchase (existing).
2. Look up the artist's `stripe_account_id` via the join above (use the service-role client because admin RLS may not grant SELECT on other artists' `profiles_stripe` rows).
3. Call `stripe.refunds.create(params, { stripeAccount })` without `reverse_transfer`.

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err } = await requireAdmin();
  if (err) return err;

  const { id: purchaseId } = await params;

  // Use service role for the lookup: the join into profiles_stripe touches a
  // table whose RLS is owner-only, and admins aren't owners.
  const admin = getSupabaseServiceRoleClient();

  const { data: purchase, error: fetchErr } = await admin
    .from('purchases')
    .select('id, status, stripe_charge_id, release_id')
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

  // Resolve the connected account id via release.artist_id → profiles_stripe.
  const { data: release, error: relErr } = await admin
    .from('releases')
    .select('artist_id')
    .eq('id', purchase.release_id)
    .single();
  if (relErr || !release) {
    return NextResponse.json({ error: 'Release not found for purchase' }, { status: 404 });
  }
  const { data: artistStripe, error: stripeRowErr } = await admin
    .from('profiles_stripe')
    .select('stripe_account_id')
    .eq('profile_id', release.artist_id)
    .maybeSingle();
  if (stripeRowErr || !artistStripe?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Artist Stripe account not found' },
      { status: 409 },
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.refunds.create(
      {
        charge: chargeId,
        // Direct charges: no transfer happened, so no transfer to reverse.
        // The application fee that flowed platform-side at capture is reversed
        // back to the artist on refund.
        refund_application_fee: true,
      },
      { stripeAccount: artistStripe.stripe_account_id },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe refund failed';
    console.error('[admin/refund] stripe.refunds.create failed:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // The webhook charge.refunded fires async on the connected account and
  // flips purchases.status to 'refunded'. We don't update the row here to
  // avoid races.
  return NextResponse.json({ ok: true, refunded_charge: chargeId });
}
```

Key removals vs commit `75eb19f`:
- `reverse_transfer: true` argument.
- Reliance on the user-cookied `supabase` from `requireAdmin()` for the purchase lookup (we now use service role so the cross-artist join doesn't fail RLS).

Key additions:
- Service-role lookup of `releases.artist_id` and `profiles_stripe.stripe_account_id`.
- `{ stripeAccount }` second arg to `stripe.refunds.create`.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/admin/purchases/[id]/refund/route.ts
git commit -m "phase3(refund): pivot to direct charges (stripeAccount + drop reverse_transfer)"
```

---

## Task 3: Pivot webhook handler to handle Connect events

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

Connect events carry `event.account = acct_...`. Any subsequent API call that targets resources living on the connected account (PaymentIntent retrieve in `handleSessionCompleted`, future expansions) MUST pass `{ stripeAccount: event.account }`. The signature verification step is unchanged — a single endpoint with a single signing secret can validate both platform and Connect events as long as Stripe Dashboard's "Listen to events on Connected accounts" toggle is on.

The dedupe ledger writes (`stripe_events` insert + `processed_at` retry-safety) and the handler dispatch switch stay identical — neither depends on the charge model.

- [ ] **Step 1: Thread `event.account` through to the PI retrieve**

Rewrite `handleSessionCompleted` to accept the connected account id and pass it to `stripe.paymentIntents.retrieve(piId, { stripeAccount })`. Update the dispatch in `POST` accordingly.

```ts
async function handleSessionCompleted(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null,
): Promise<void> {
  // Resolve the charge id by retrieving the PaymentIntent. Under direct
  // charges, the PI lives on the connected account, so we MUST pass
  // stripeAccount on the retrieve call. Without it Stripe returns 404
  // (the platform account doesn't own the PI).
  const stripe = getStripeClient();
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  let chargeId: string | null = null;
  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(
      piId,
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
    );
    chargeId = typeof pi.latest_charge === 'string'
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;
  }

  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'succeeded',
      stripe_payment_intent_id: piId,
      stripe_charge_id: chargeId,
      succeeded_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);
  if (error) throw new Error(`update purchase succeeded: ${error.message}`);
}
```

In the dispatch block of `POST`, pass `event.account ?? null` through:

```ts
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSessionCompleted(
          supabase,
          event.data.object as Stripe.Checkout.Session,
          event.account ?? null,
        );
        break;
      case 'checkout.session.expired':
        // No API retrieves needed; row lookup is by session.id which is
        // globally unique across platform + connected accounts.
        await handleSessionExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded':
        // Charge.id is globally unique; the purchases-table lookup by
        // stripe_charge_id needs no account context.
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;
      case 'account.updated':
        // Platform-origin event keyed by account.id; no stripeAccount needed.
        await handleAccountUpdated(supabase, event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
    await supabase
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhook] handler for ${event.type} failed:`, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
```

`handleSessionExpired`, `handleChargeRefunded`, and `handleAccountUpdated` are unchanged. Document why in the inline comments above.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/webhooks/stripe/route.ts
git commit -m "phase3(webhook): handle Connect events (thread event.account into PI retrieve)"
```

---

## Task 4: Server endpoint for AccountSession (TDD)

**Files:**
- Create: `app/api/stripe/account-sessions/route.ts`
- Create: `tests/api/account-sessions.test.ts`

This endpoint is the only piece that warrants TDD: the auth / `is_artist` / `stripe_account_id`-bootstrap branching is the kind of logic where regressions silently leak unauthorised AccountSession secrets. The Stripe API call itself is mocked.

- [ ] **Step 1: Write failing tests**

```ts
// tests/api/account-sessions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn();
const fromMock = vi.fn();
const upsertMock = vi.fn();
const accountSessionsCreateMock = vi.fn();
const createExpressAccountMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock('@/lib/stripe', () => ({
  getStripeClient: () => ({
    accountSessions: { create: accountSessionsCreateMock },
  }),
  createExpressAccount: createExpressAccountMock,
  isStripeConfigured: () => true,
}));

import { POST } from '@/app/api/stripe/account-sessions/route';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest() {
  return new Request('http://localhost/api/stripe/account-sessions', {
    method: 'POST',
  });
}

describe('POST /api/stripe/account-sessions', () => {
  it('rejects unauthenticated callers with 401', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('rejects non-artist profiles with 403', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { is_artist: false } }),
        }),
      }),
    });
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(403);
  });

  it('creates a Stripe account when artist has none, then issues client_secret', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call += 1;
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { is_artist: true } }),
            }),
          }),
        };
      }
      if (call === 2) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      return {
        upsert: upsertMock.mockResolvedValue({ error: null }),
      };
    });
    createExpressAccountMock.mockResolvedValue('acct_new');
    accountSessionsCreateMock.mockResolvedValue({ client_secret: 'secret_xyz' });

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client_secret).toBe('secret_xyz');
    expect(createExpressAccountMock).toHaveBeenCalledWith('a@b.c');
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: 'acct_new',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    });
  });

  it('reuses an existing stripe_account_id when present', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { is_artist: true } }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { stripe_account_id: 'acct_existing' } }),
          }),
        }),
      };
    });
    accountSessionsCreateMock.mockResolvedValue({ client_secret: 'secret_existing' });

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(200);
    expect(createExpressAccountMock).not.toHaveBeenCalled();
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: 'acct_existing',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    });
  });
});
```

Run the tests; they should fail (route doesn't exist).

```bash
pnpm test tests/api/account-sessions.test.ts
```

- [ ] **Step 2: Implement the route to make tests pass**

```ts
// app/api/stripe/account-sessions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createExpressAccount, getStripeClient, isStripeConfigured } from '@/lib/stripe';
import { requireActiveAccount } from '@/lib/api/require-active';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this deployment.' },
      { status: 503 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_artist')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_artist) {
    return NextResponse.json({ error: 'Artists only' }, { status: 403 });
  }

  // Look up or bootstrap the connected account id. The same upsert pattern
  // already used by /api/artist/stripe/connect — keep behaviour consistent.
  const { data: stripeRow } = await supabase
    .from('profiles_stripe')
    .select('stripe_account_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  let accountId = stripeRow?.stripe_account_id ?? null;
  if (!accountId) {
    try {
      accountId = await createExpressAccount(user.email ?? '');
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Stripe error' },
        { status: 502 },
      );
    }
    const { error: upsertErr } = await supabase
      .from('profiles_stripe')
      .upsert(
        { profile_id: user.id, stripe_account_id: accountId },
        { onConflict: 'profile_id' },
      );
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  // Mint a short-lived AccountSession scoped to the onboarding component.
  // The client_secret is single-use and bound to (account, components);
  // the embedded UI calls fetchClientSecret() each time it remounts.
  try {
    const stripe = getStripeClient();
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    });
    return NextResponse.json({ client_secret: session.client_secret });
  } catch (err) {
    console.error('[account-sessions] create failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 502 },
    );
  }
}
```

Re-run tests; all four should pass.

```bash
pnpm test tests/api/account-sessions.test.ts
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/stripe/account-sessions/route.ts tests/api/account-sessions.test.ts
git commit -m "phase3(stripe): AccountSession endpoint for embedded onboarding (TDD)"
```

---

## Task 5: Client embedded Stripe Connect component + dependency install

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `components/stripe/embedded-connect.tsx`

A single wrapper component handles BOTH onboarding and management. The parent (payouts card) chooses which Stripe component to render via the `mode` prop based on `payout_enabled`. The Connect.js instance is shared across mounts of the same parent.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @stripe/connect-js @stripe/react-connect-js
```

- [ ] **Step 2: Implement the component**

```tsx
// components/stripe/embedded-connect.tsx
'use client';

import { useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
} from '@stripe/react-connect-js';

interface Props {
  /** Which Stripe component to render. */
  mode: 'onboarding' | 'management';
  /** Called when the embedded UI raises onExit (only fires for onboarding). */
  onExit?: () => void;
}

/**
 * Renders Stripe's embedded Connect components inside SynthCamp. The fetch
 * callback hits /api/stripe/account-sessions, which authenticates the user,
 * bootstraps their connected account if missing, and returns a fresh
 * client_secret with both account_onboarding and account_management
 * components enabled. The parent picks which component to mount based on
 * payout_enabled state.
 */
export function EmbeddedConnect({ mode, onExit }: Props) {
  const [error, setError] = useState<string | null>(null);

  const [stripeConnectInstance] = useState(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
      return null;
    }
    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const res = await fetch('/api/stripe/account-sessions', {
          method: 'POST',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `AccountSession failed (${res.status})`);
        }
        const { client_secret } = (await res.json()) as { client_secret: string };
        return client_secret;
      },
      // Match SynthCamp's dark glass aesthetic so the embedded form
      // doesn't look like a foreign widget.
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#ffffff',
          colorBackground: 'transparent',
          colorText: '#ffffff',
          fontFamily: 'inherit',
        },
      },
    });
  });

  if (error) {
    return <p className="text-xs italic text-red-400">{error}</p>;
  }
  if (!stripeConnectInstance) return null;

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      {mode === 'onboarding' ? (
        <ConnectAccountOnboarding
          onExit={() => {
            if (onExit) onExit();
          }}
        />
      ) : (
        <ConnectAccountManagement />
      )}
    </ConnectComponentsProvider>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add package.json pnpm-lock.yaml components/stripe/embedded-connect.tsx
git commit -m "phase3(stripe): embedded Connect component (onboarding + management) + deps"
```

---

## Task 6: Replace hosted-onboarding CTA in payouts card

**Files:**
- Modify: `components/settings/payouts-card.tsx`

The existing card calls `POST /api/artist/stripe/connect` and redirects to a Stripe-hosted Account Link. Replace that path with a disclosure that mounts `<EmbeddedOnboarding />` inline. Keep the `payout_enabled` ribbon; keep the labels driven by `hasAccount` / `payoutEnabled`. Once mounted, the card shows the embedded UI; on `onExit`, it triggers a `router.refresh()` so the page picks up the freshly-set `payout_enabled` from the webhook side-effect.

> Leave the legacy `createOnboardingLink` shim in `lib/stripe.ts` and the `app/api/artist/stripe/connect/route.ts` route in place — they're a usable fallback if the embedded flow ever needs to be disabled. Just stop calling the route from the UI.

```tsx
// components/settings/payouts-card.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmbeddedConnect } from '@/components/stripe/embedded-connect';

interface PayoutsCardProps {
  hasAccount: boolean;
  payoutEnabled: boolean;
}

export function PayoutsCard({ hasAccount, payoutEnabled }: PayoutsCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const label = payoutEnabled
    ? 'Manage payouts'
    : hasAccount
      ? 'Continue Stripe setup'
      : 'Set up payouts';

  return (
    <GlassPanel className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold italic text-white">Payouts</h3>
          <p className="text-xs text-white/60">
            {payoutEnabled
              ? 'Stripe Connect is active.'
              : 'Connect a Stripe account to receive sales payouts.'}
          </p>
        </div>
        {payoutEnabled && (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Ready
          </span>
        )}
      </div>

      {!open && (
        <Button
          variant={payoutEnabled ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}

      {open && (
        <div className="space-y-3">
          <EmbeddedConnect
            mode={payoutEnabled ? 'management' : 'onboarding'}
            onExit={() => {
              setOpen(false);
              // The account.updated webhook flips payout_enabled; refresh
              // the server component so the ribbon and label catch up.
              router.refresh();
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      )}
    </GlassPanel>
  );
}
```

- [ ] **Step 1: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/settings/payouts-card.tsx
git commit -m "phase3(settings): swap hosted onboarding for embedded component"
```

---

## Task 7: Deploy + Stripe Dashboard config + end-to-end smoke

- [ ] **Step 1: Push commits**

```bash
git push origin main
```

- [ ] **Step 2: Set Railway env vars on Next.js service**

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = the test-mode publishable key (`pk_test_...`) from Stripe Dashboard → Developers → API keys. (Required client-side.)

Confirm a Railway redeploy fires after the env change.

- [ ] **Step 3: Update the existing webhook endpoint to also receive Connect events**

In Stripe Dashboard → Developers → Webhooks → existing endpoint at `https://synthcamp.net/api/webhooks/stripe`:

1. Open the endpoint settings.
2. Toggle **"Listen to events on Connected accounts"** ON. Confirm the existing event subscriptions (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `account.updated`) are still selected.
3. Save. The signing secret is unchanged; do not rotate it.

- [ ] **Step 4: Verify a Connect-origin event reaches the handler**

```bash
# Trigger a Connect event against a test connected account.
stripe trigger account.updated --stripe-account acct_TEST_ID
```

Watch Railway logs of the Next.js service. Expected:
- `[webhook]` lines (no errors).
- `stripe_events` table picks up a row for the event id; `processed_at` is set.

- [ ] **Step 5: End-to-end smoke test**

Pre-requisites: an artist account whose `profiles_stripe.payout_enabled` is `true` (re-onboard via the embedded flow if needed); a published release.

1. **Onboarding flow:** as a freshly-flagged `is_artist` user, open `/settings/profile`, click **Set up payouts**, complete the embedded form. Confirm `account.updated` fires and `payout_enabled` flips. The card should show the **Ready** ribbon after a `router.refresh()`.
2. **Checkout flow:** as a buyer, hit `POST /api/releases/<id>/checkout` with `{amount_cents: <minOrMore>}`. Open the returned `session_url`. Pay with Stripe test card `4242 4242 4242 4242`.
3. **Verify in DB:**
   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres -c \
     "SELECT id, status, succeeded_at, stripe_charge_id, stripe_session_id \
      FROM purchases ORDER BY created_at DESC LIMIT 3;"
   ```
   Latest row: `status='succeeded'`, `succeeded_at` set, `stripe_charge_id` populated.
4. **Verify in Stripe Dashboard:**
   - Switch the dashboard view to the **connected account** (top-left dropdown).
   - The PaymentIntent should appear in that account's Payments list with `application_fee_amount` deducted.
   - The card statement should show `SYNTHCAMP` (visible on the PI detail page under "Statement descriptor").
5. **Refund flow:** as an admin, `POST /api/admin/purchases/<id>/refund`. The Stripe Dashboard (connected account view) should show the refund with the application fee reversed; the `purchases` row flips to `refunded` once `charge.refunded` is processed.

---

## Pivot done when:

- Checkout creates the Session on the connected account (verified in connected-account dashboard view).
- Refund runs against the connected account, with `application_fee` reversed and no transfer-reversal errors.
- Webhook processes both platform and Connect events from the same endpoint and updates `purchases` / `profiles_stripe` correctly.
- Embedded onboarding completes end-to-end inside `/settings/profile` without any redirect to a Stripe-hosted page.
- All seven commits pushed to `origin/main`; Railway redeploy green.

## What's untouched on purpose

- `record_purchase` RPC and `purchases`/`stripe_events`/`profiles_stripe` schemas (charge model agnostic).
- `lib/stripe.ts` legacy `createOnboardingLink` / `createExpressAccount` REST shims (kept as fallback).
- `app/api/artist/stripe/connect/route.ts` (still works, just no longer wired into the UI).
- The Lot 3 idempotency key shape, retry-safety dedupe, and signature-verification block.
