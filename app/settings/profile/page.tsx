import { SignInGate } from '@/components/auth/sign-in-gate';
import { PayoutsCard } from '@/components/settings/payouts-card';
import { getCurrentProfile } from '@/lib/data/profile';
import { ProfileForm } from './profile-form';

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to edit your profile" />;

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Profile
      </h2>
      <ProfileForm initialProfile={profile} />
      {profile.is_artist && (
        <PayoutsCard
          hasAccount={Boolean(profile.stripe_account_id)}
          payoutEnabled={profile.payout_enabled}
        />
      )}
    </main>
  );
}
