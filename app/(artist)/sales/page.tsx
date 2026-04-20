import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

export default function ArtistSalesPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32 text-left">
      <h2 className="text-4xl leading-none font-black tracking-tighter text-indigo-400 uppercase italic">
        Earnings
      </h2>

      <GlassPanel className="border-indigo-500/20 bg-indigo-500/5 p-8 text-center">
        <p className="mb-3 text-[10px] leading-none font-black tracking-[0.3em] text-indigo-400 uppercase">
          Withdrawable Balance
        </p>
        <p className="font-mono text-6xl leading-none font-black tracking-tighter text-white italic">
          $3,240<span className="text-2xl text-white/70">.50</span>
        </p>
        <Button variant="accent" size="md" className="mt-8">
          Request Payout
        </Button>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="mb-4 border-b border-white/5 pb-2 text-[10px] font-black tracking-[0.3em] text-white/60 uppercase">
          Recent Sales
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Neural Drift #1</span>
            <span className="font-mono text-indigo-400">+$14.99</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Echoes of the Soil (Album)</span>
            <span className="font-mono text-indigo-400">+$24.99</span>
          </div>
        </div>
      </GlassPanel>
    </main>
  );
}
