import type { CreditCategory } from '@/lib/database.types';

export interface WizardTrack {
  // UI-only unique key (e.g. crypto.randomUUID())
  uiKey: string;
  // Server-side id once the track is created via POST /api/releases/:id/tracks
  id?: string;
  title: string;
  duration_seconds: number;
  audio_source_key?: string;
  track_number: number;
}

export interface WizardState {
  releaseId: string | null;
  releaseSlug: string | null;
  // Step 1
  title: string;
  description: string;
  coverUrl: string | null;
  language: string; // ISO 639-1 (e.g. "fr")
  genres: string[];
  // Step 2
  tracks: WizardTrack[];
  // Step 3
  credits: {
    category: CreditCategory;
    tags: string[];
    narrative: string;
    perTrack: boolean;
  };
  // Step 4
  party: {
    enabled: boolean;
    roomId: string | null;
    scheduledAt: string | null; // ISO
  };
  releaseDate: {
    mode: 'immediate' | 'future';
    date: string | null; // ISO for future
  };
}

export const INITIAL_WIZARD_STATE: WizardState = {
  releaseId: null,
  releaseSlug: null,
  title: '',
  description: '',
  coverUrl: null,
  language: '',
  genres: [],
  tracks: [],
  credits: { category: 'ai_crafted', tags: [], narrative: '', perTrack: false },
  party: { enabled: true, roomId: null, scheduledAt: null },
  releaseDate: { mode: 'immediate', date: null },
};

export const STEP_LABELS = ['Metadata', 'Tracks', 'Credits', 'Pricing & Party', 'Publish'] as const;
