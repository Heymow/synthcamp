import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createExpressAccount, getStripeClient, isStripeConfigured } from '@/lib/stripe';
import { requireActiveAccount } from '@/lib/api/require-active';
import { enforceLimit } from '@/lib/api/limit';

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

  // Throttle: prevents two near-concurrent first-time hits from each calling
  // createExpressAccount and orphaning a Stripe account. Mirrors the limit
  // already on /api/artist/stripe/connect.
  const limited = enforceLimit(`user:${user.id}:stripe:connect`, 5, 300);
  if (limited) return limited;

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
