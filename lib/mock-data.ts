export type CreditCategory = 'acoustic' | 'hybrid' | 'ai_crafted';

export interface Release {
  id: number;
  title: string;
  artist: string;
  trackCount: number;
  cover: string;
  category?: CreditCategory;
}

export interface SoundRoom {
  id: number;
  title: string;
  artist: string;
  listeners: number;
  baseTime: number;
  isCountdown: boolean;
  cover: string;
  countries: string;
}

export const NEW_RELEASES: Release[] = [
  {
    id: 1,
    title: 'Neural Drift',
    artist: 'Alexia V.',
    trackCount: 12,
    cover: '/mock-covers/cover-01.jpg',
  },
  {
    id: 2,
    title: 'Soil Echoes',
    artist: 'Root System',
    trackCount: 4,
    cover: '/mock-covers/cover-02.jpg',
  },
  {
    id: 3,
    title: 'Binary Folk',
    artist: 'Ghost Patch',
    trackCount: 1,
    cover: '/mock-covers/cover-03.jpg',
  },
  {
    id: 4,
    title: 'Latent Voice',
    artist: 'Neuro-Choral',
    trackCount: 8,
    cover: '/mock-covers/cover-04.jpg',
  },
  {
    id: 5,
    title: 'Static Wind',
    artist: 'Amber',
    trackCount: 5,
    cover: '/mock-covers/cover-05.jpg',
  },
  {
    id: 6,
    title: 'Silicon Soul',
    artist: 'The Core',
    trackCount: 14,
    cover: '/mock-covers/cover-06.jpg',
  },
];

export const HERO_RELEASE: Release = {
  id: 100,
  title: 'Aura Genesis',
  artist: 'Sylvan Woods',
  trackCount: 12,
  cover: '/mock-covers/hero.jpg',
};

const now = Date.now();
export const MAIN_ROOM_START = now - (45 * 60 * 1000 + 23 * 1000);
export const SECONDARY_ROOM_1_START = now - 12 * 60 * 1000;
export const SECONDARY_ROOM_2_START = now + (5 * 60 * 1000 + 42 * 1000);

export const MAIN_ROOM = {
  title: 'Latent Spaces Premiere',
  artist: 'Sylvan Woods',
  listeners: 1200,
  cover: '/mock-covers/room-bg.jpg',
  channel: 'Global Master Channel',
  tagline: 'Experience the master cut with 1.2k listeners',
  countries: 'London, Paris, Tokyo, Berlin, NYC...',
};

export const SECONDARY_ROOMS: SoundRoom[] = [
  {
    id: 1,
    title: 'Neural Drift Jam',
    artist: 'Alexia V.',
    listeners: 840,
    baseTime: SECONDARY_ROOM_1_START,
    isCountdown: false,
    cover: '/mock-covers/cover-02.jpg',
    countries: 'France, United Kingdom, Germany',
  },
  {
    id: 2,
    title: 'Binary Soundscape',
    artist: 'Ghost Patch',
    listeners: 420,
    baseTime: SECONDARY_ROOM_2_START,
    isCountdown: true,
    cover: '/mock-covers/cover-03.jpg',
    countries: 'Japan, United States, Canada',
  },
];

export const ARTIST_RELEASES: Release[] = [
  {
    id: 201,
    title: 'Echoes of the Soil',
    artist: 'John Doe',
    trackCount: 12,
    cover: '/mock-covers/cover-04.jpg',
  },
  {
    id: 202,
    title: 'Neural Folk EP',
    artist: 'John Doe',
    trackCount: 4,
    cover: '/mock-covers/cover-05.jpg',
  },
];
