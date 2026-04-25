import { SignInGate } from '@/components/auth/sign-in-gate';
import { PayoutsCard } from '@/components/settings/payouts-card';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to edit your profile" />;

  // stripe_account_id / payout_enabled moved off public.profiles into
  // public.profiles_stripe so the public SELECT policy can't leak them.
  // Fetch separately; owner-only RLS returns the row (or null if the
  // artist hasn't started onboarding yet).
  let hasAccount = false;
  let payoutEnabled = false;
  if (profile.is_artist) {
    const supabase = await getSupabaseServerClient();
    const { data: stripeRow } = await supabase
      .from('profiles_stripe')
      .select('stripe_account_id, payout_enabled')
      .eq('profile_id', profile.id)
      .maybeSingle();
    hasAccount = Boolean(stripeRow?.stripe_account_id);
    payoutEnabled = stripeRow?.payout_enabled ?? false;
  }

  return (
    <main className="view-enter mx-auto max-w-2xl space-y-8 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Profile
      </h2>
      <ProfileForm initialProfile={profile} />
      {profile.is_artist && <PayoutsCard hasAccount={hasAccount} payoutEnabled={payoutEnabled} />}
    </main>
  );
}
