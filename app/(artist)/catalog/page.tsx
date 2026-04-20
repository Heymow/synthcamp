import Image from 'next/image';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import { ARTIST_RELEASES } from '@/lib/mock-data';

export default function ArtistCatalogPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between text-white/90">
        <h2 className="text-4xl leading-none font-black tracking-tighter text-white uppercase italic">
          My Music
        </h2>
        <p className="mb-1 text-[10px] font-bold tracking-widest uppercase italic">
          2 active releases
        </p>
      </div>

      <div className="space-y-4">
        {ARTIST_RELEASES.map((release, idx) => (
          <GlassPanel
            key={release.id}
            className="flex cursor-pointer items-center gap-5 p-4 transition-transform hover:bg-white/[0.05] active:scale-[0.98]"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Image
                src={release.cover}
                alt={`${release.title} cover`}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 overflow-hidden text-sm text-white/90">
              <h3 className="truncate text-lg leading-tight font-bold text-white italic">
                {release.title}
              </h3>
              <p className="mb-1 text-[10px] font-medium">by {release.artist}</p>
              <p className="text-[9px] font-bold tracking-widest text-white/70 uppercase italic">
                {getReleaseLabel(release.trackCount)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] leading-none font-bold text-white italic">
                ${getPrice(release.trackCount)}
              </p>
              <p className="mt-1 text-[9px] font-bold tracking-tighter text-indigo-400 uppercase">
                {idx === 0 ? '842' : '12'} Sales
              </p>
            </div>
          </GlassPanel>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 text-white/90">
        <GlassPanel className="p-6">
          <p className="mb-1 text-[9px] font-bold tracking-[0.2em] text-white/70 uppercase">
            Total Revenue
          </p>
          <p className="font-mono text-2xl leading-none font-black tracking-tighter text-white">
            $3,240.50
          </p>
        </GlassPanel>
        <GlassPanel className="border-indigo-500/20 bg-indigo-500/5 p-6">
          <p className="mb-1 text-[9px] font-bold tracking-[0.2em] text-white/70 uppercase">
            Fan Base
          </p>
          <p className="text-2xl leading-none font-black tracking-tighter text-white">12.8k</p>
        </GlassPanel>
      </div>
    </main>
  );
}
