import { HeroRelease } from '@/components/catalog/hero-release';
import { ReleaseCard } from '@/components/catalog/release-card';
import { SoundRoomMain } from '@/components/rooms/sound-room-main';
import { SoundRoomCompact } from '@/components/rooms/sound-room-compact';
import { NEW_RELEASES, HERO_RELEASE, SECONDARY_ROOMS } from '@/lib/mock-data';

export default function ExploreHomePage() {
  return (
    <main className="view-enter mx-auto max-w-4xl space-y-12 px-6 pb-32">
      <HeroRelease release={HERO_RELEASE} />

      <section>
        <div className="mb-6 flex items-center justify-between text-white/80">
          <h3 className="text-[10px] font-black tracking-[0.4em] uppercase">New Releases</h3>
          <div className="ml-6 h-[1px] flex-1 bg-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {NEW_RELEASES.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      </section>

      <section className="pb-20">
        <div className="mb-6 flex items-center justify-between text-white/80">
          <h3 className="text-[10px] font-black tracking-[0.4em] uppercase">Active Sound Rooms</h3>
          <div className="ml-6 h-[1px] flex-1 bg-white/20" />
        </div>
        <div className="space-y-6">
          <SoundRoomMain />
          <div className="grid grid-cols-1 gap-4">
            {SECONDARY_ROOMS.map((room) => (
              <SoundRoomCompact key={room.id} room={room} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
