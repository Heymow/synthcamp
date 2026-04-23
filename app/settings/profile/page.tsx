import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/data/profile';
import { ProfileForm } from './profile-form';

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Profile
      </h2>
      <ProfileForm initialProfile={profile} />
    </main>
  );
}
