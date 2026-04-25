import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { resolveOrigin } from '@/lib/auth/origin';
import {
  createExpressAccount,
  createOnboardingLink,
  isStripeConfigured,
} from '@/lib/stripe';

export async function POST(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:stripe:connect`, 5, 300);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_artist')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 404 });
  if (!profile.is_artist) {
    return NextResponse.json({ error: 'Artists only' }, { status: 403 });
  }

  // stripe_account_id lives on public.profiles_stripe (owner-only RLS) so
  // it isn't exposed by the profile's public SELECT policy. The row is
  // absent until the artist starts onboarding.
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
    // Upsert so both the first-ever onboarding (no row yet) and any retry
    // after a prior partial failure write the account id cleanly.
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

  // resolveOrigin prefers NEXT_PUBLIC_APP_URL, then X-Forwarded-Host from
  // the proxy, and only falls back to request.url — never localhost. This
  // matters because onboarded artists are redirected here by Stripe, and
  // a prod deploy missing NEXT_PUBLIC_APP_URL used to send them to
  // http://localhost:3000.
  const origin = resolveOrigin(request);
  const returnUrl = `${origin}/settings/profile?stripe=return`;
  const refreshUrl = `${origin}/settings/profile?stripe=refresh`;

  try {
    const url = await createOnboardingLink(accountId, returnUrl, refreshUrl);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe link error' },
      { status: 502 },
    );
  }
}
