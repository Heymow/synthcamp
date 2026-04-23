import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { getCurrentProfile } from '@/lib/data/profile';

export default async function LibraryPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to see your library" />;

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Library
      </h2>
      <GlassPanel className="p-8 text-center">
        <p className="text-sm italic text-white/70">Your library is empty.</p>
        <p className="mt-2 text-xs italic text-white/50">
          Buy a release (Phase 3) or follow an artist (Phase 5) to see it here.
        </p>
      </GlassPanel>
    </main>
  );
}
