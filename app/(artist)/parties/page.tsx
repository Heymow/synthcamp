import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ArtistPartiesPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pt-10 pb-32 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-600/20">
        <Users size={32} strokeWidth={2} className="text-indigo-400" />
      </div>
      <h2 className="text-3xl leading-none font-black text-white uppercase italic">
        Listening Parties
      </h2>
      <p className="text-sm text-white/60 italic">Scheduled sessions with your fans appear here.</p>
      <Button variant="ghost" size="sm" className="mt-4">
        Schedule Party
      </Button>
    </main>
  );
}
