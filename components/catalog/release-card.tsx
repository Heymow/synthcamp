import Image from 'next/image';
import { Play } from 'lucide-react';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import type { Release } from '@/lib/mock-data';

export interface ReleaseCardProps {
  release: Release;
}

export function ReleaseCard({ release }: ReleaseCardProps) {
  return (
    <article className="group cursor-pointer space-y-3 text-left">
      <div className="glass-panel relative aspect-square overflow-hidden rounded-[2rem] border-white/5 transition-transform active:scale-95">
        <Image
          src={release.cover}
          alt={`${release.title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover opacity-80 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <Play size={20} fill="currentColor" />
          </div>
        </div>
      </div>
      <div>
        <p className="truncate text-sm leading-none font-bold tracking-tight text-white italic">
          {release.title}
        </p>
        <p className="mt-1 text-[10px] leading-none font-medium text-white/80">
          by {release.artist}
        </p>
        <div className="mt-2.5 flex items-center justify-between px-0.5">
          <p className="text-[9px] font-bold tracking-widest text-white/70 uppercase">
            {getReleaseLabel(release.trackCount)}
          </p>
          <span className="font-mono text-[11px] font-black tracking-tighter text-indigo-400">
            ${getPrice(release.trackCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
