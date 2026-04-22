import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getPrice, getReleaseLabel } from '@/lib/pricing';

export interface HeroReleaseProps {
  release: {
    id: string;
    title: string;
    slug: string;
    cover_url: string;
    description: string | null;
    artist: { display_name: string };
    tracks_count: number;
  };
  editorsChoice?: boolean;
  tagline?: string;
}

export function HeroRelease({
  release,
  editorsChoice = true,
  tagline,
}: HeroReleaseProps) {
  const effectiveTagline = tagline ?? release.description ?? '';
  return (
    <section className="album-shadow group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-[3rem] sm:aspect-video">
      <Image
        src={release.cover_url}
        alt={`${release.title} cover`}
        fill
        sizes="(max-width: 768px) 100vw, 66vw"
        className="object-cover transition-transform duration-1000 group-hover:scale-105"
        priority
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute bottom-10 left-10 z-20 space-y-2 text-left text-white">
        {editorsChoice && (
          <span className="inline-block rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg">
            Editor&apos;s Choice
          </span>
        )}
        <h2 className="text-4xl font-black italic uppercase leading-none">{release.title}</h2>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/90">
          By {release.artist.display_name}
        </p>
        {effectiveTagline && (
          <p className="max-w-xs text-sm italic leading-tight text-white/80">{effectiveTagline}</p>
        )}
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {getReleaseLabel(release.tracks_count)}
        </p>
        <div className="flex gap-4 pt-4">
          <Button variant="primary" size="md">
            Listen Now
          </Button>
          <Button variant="glass" size="md">
            ${getPrice(release.tracks_count)}
          </Button>
        </div>
      </div>
    </section>
  );
}
