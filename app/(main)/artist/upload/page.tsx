import { notFound, redirect } from 'next/navigation';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { UploadWizard } from './upload-wizard';
import { INITIAL_WIZARD_STATE, type WizardState, type WizardTrack } from './types';
import type { CreditCategory } from '@/lib/database.types';

interface UploadPageProps {
  searchParams: Promise<{ draftId?: string }>;
}

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to upload a release" />;
  if (!profile.is_artist) redirect('/settings/profile');

  const { draftId } = await searchParams;

  if (!draftId) {
    return <UploadWizard artistId={profile.id} />;
  }

  // Resume flow: fetch the draft and rebuild WizardState.
  const supabase = await getSupabaseServerClient();
  const { data: release } = await supabase
    .from('releases')
    .select(
      'id, slug, title, description, cover_url, language, genres, credit_category, credit_tags, credit_narrative, credits_per_track, release_date, status, artist_id',
    )
    .eq('id', draftId)
    .single();
  if (!release) notFound();
  if (release.artist_id !== profile.id) notFound();
  if (release.status !== 'draft') {
    // Already past draft: bounce to the release page instead of trying to
    // re-enter the wizard on a published/scheduled release.
    redirect(`/r/${release.slug}`);
  }

  const { data: tracksRaw } = await supabase
    .from('tracks')
    .select('id, title, duration_seconds, audio_source_key, track_number')
    .eq('release_id', draftId)
    .order('track_number', { ascending: true });

  const { data: party } = await supabase
    .from('listening_parties')
    .select('room_id, scheduled_at')
    .eq('release_id', draftId)
    .maybeSingle();

  const tracks: WizardTrack[] = (tracksRaw ?? []).map((t) => ({
    uiKey: t.id,
    id: t.id,
    title: t.title,
    duration_seconds: t.duration_seconds,
    audio_source_key: t.audio_source_key ?? undefined,
    track_number: t.track_number,
  }));

  const initialState: WizardState = {
    ...INITIAL_WIZARD_STATE,
    releaseId: release.id,
    releaseSlug: release.slug,
    title: release.title,
    description: release.description ?? '',
    coverUrl: release.cover_url || null,
    language: release.language ?? '',
    genres: release.genres ?? [],
    tracks,
    credits: {
      category: (release.credit_category ?? 'ai_crafted') as CreditCategory,
      tags: release.credit_tags ?? [],
      narrative: release.credit_narrative ?? '',
      perTrack: release.credits_per_track ?? false,
    },
    party: party
      ? {
          enabled: true,
          roomId: party.room_id,
          scheduledAt: party.scheduled_at,
        }
      : INITIAL_WIZARD_STATE.party,
    releaseDate: release.release_date
      ? { mode: 'future', date: release.release_date }
      : { mode: 'immediate', date: null },
  };

  // Pick the earliest step where something's clearly missing. If tracks are
  // empty, jump to tracks. If everything's present, start on Publish so the
  // artist can just push it out.
  const initialStep =
    tracks.length === 0 ? 1 : !release.credit_narrative && release.credit_category === 'ai_crafted' ? 2 : 4;

  return (
    <UploadWizard artistId={profile.id} initialState={initialState} initialStep={initialStep} />
  );
}
