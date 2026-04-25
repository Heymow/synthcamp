import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    return NextResponse.json(
      { error: minErr?.message ?? 'price lookup failed' },
      { status: 500 },
    );
  }
  // Defensive: even the floor must respect the hard cap.
  if (minCents > HARD_CAP_CENTS) {
    return NextResponse.json(
      {
        error: `Computed minimum (${minCents} cents) exceeds hard cap (${HARD_CAP_CENTS}); release is unpurchasable`,
      },
      { status: 403 },
    );
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
      {
        error: `Invalid amount. Must be an integer between ${minCents} and ${HARD_CAP_CENTS} cents.`,
      },
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

  // Idempotency: bucket by buyer + release + amount + minute. Including
  // the amount means a user changing the PWYW slider within 60s creates a
  // new session (correct UX). The minute bucket still absorbs accidental
  // double-clicks of the same amount.
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `checkout:${user.id}:${releaseId}:${amountCents}:${minuteBucket}`;

  // Stripe Tax: omit by default. Auto-tax requires per-account capability
  // setup that we don't manage in Lot 3 (each artist would need to opt in
  // via Stripe Dashboard). Phase 3.5 work: detect capability and enable
  // selectively. For now, artists handle their own tax compliance per
  // jurisdiction — documented in payouts dashboard copy.
  // (No `automatic_tax` field in the session below.)

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
        statement_descriptor_suffix: 'SYNTHCAMP',
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

  // 7. Reserve a pending purchase row. record_purchase is service-role-only
  // by design — the row write bypasses purchases-RLS-no-INSERT policy.
  // We've already authenticated the buyer (user.id is verified) and
  // validated the amount above, so the service-role escalation here is
  // safe and scoped.
  const adminSupabase = getSupabaseServiceRoleClient();
  const { error: recordErr } = await adminSupabase.rpc('record_purchase', {
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
    // 23505 means a pending row already exists for this (buyer, release).
    // That's the idempotency-replay path — the existing session URL is
    // safe to return.
    if (recordErr.code !== '23505') {
      console.error('[checkout] record_purchase failed:', recordErr);
      return NextResponse.json(
        { error: `Failed to record pending purchase: ${recordErr.message}` },
        { status: 500 },
      );
    }
    console.log('[checkout] record_purchase idempotency replay:', {
      buyer_id: user.id,
      release_id: release.id,
      session_id: session.id,
    });
  }

  return NextResponse.json({ session_url: session.url, session_id: session.id });
}
