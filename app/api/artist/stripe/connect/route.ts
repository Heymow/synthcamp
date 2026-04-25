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
    .select('is_artist, stripe_account_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 404 });
  if (!profile.is_artist) {
    return NextResponse.json({ error: 'Artists only' }, { status: 403 });
  }

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    try {
      accountId = await createExpressAccount(user.email ?? '');
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Stripe error' },
        { status: 502 },
      );
    }
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
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
