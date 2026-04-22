import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/data/profile';
import { UploadWizard } from './upload-wizard';

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');
  if (!profile.is_artist) redirect('/settings/profile');

  return <UploadWizard artistId={profile.id} />;
}
