'use client';

import { useState } from 'react';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

export default function ArtistUploadPage() {
  const [creditsLevel, setCreditsLevel] = useState(50);

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32 text-white/90">
      <h2 className="text-center text-4xl leading-none font-black tracking-tighter text-white uppercase italic">
        New
        <br />
        <span className="text-sm tracking-widest text-white/60 italic not-italic underline">
          Release
        </span>
      </h2>

      <GlassPanel className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center border-2 border-dashed border-white/10 p-10 transition-transform hover:bg-white/[0.05] active:scale-[0.98]">
        <UploadIcon size={48} strokeWidth={1.5} className="mb-6 text-white/60" />
        <p className="text-sm font-bold tracking-widest text-white/80 uppercase">
          Select Audio Files
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-8 p-8 text-left">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl leading-none font-bold tracking-tight text-white italic">
              Creative Credits
            </p>
            <p className="mt-1 text-[10px] font-bold tracking-widest text-white/70 uppercase">
              Coming soon — full form in next phase
            </p>
          </div>
          <p className="font-mono text-4xl leading-none font-black tracking-tighter text-indigo-400">
            {creditsLevel}%
          </p>
        </div>
        <input
          type="range"
          aria-label="Creative credits placeholder slider (non-functional)"
          className="w-full cursor-pointer accent-indigo-500"
          value={creditsLevel}
          onChange={(e) => setCreditsLevel(Number(e.target.value))}
        />
        <Button variant="primary" size="lg" className="w-full shadow-xl shadow-white/5">
          Publish Release
        </Button>
      </GlassPanel>
    </main>
  );
}
