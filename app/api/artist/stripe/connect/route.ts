import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import {
  createExpressAccount,
  createOnboardingLink,
  isStripeConfigured,
} from '@/lib/stripe';

export async function POST() {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const returnUrl = `${appUrl}/settings/profile?stripe=return`;
  const refreshUrl = `${appUrl}/settings/profile?stripe=refresh`;

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
