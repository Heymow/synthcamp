import { redirect } from 'next/navigation';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { getCurrentProfile } from '@/lib/data/profile';
import { UploadWizard } from './upload-wizard';

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to upload a release" />;
  if (!profile.is_artist) redirect('/settings/profile');

  return <UploadWizard artistId={profile.id} />;
}
