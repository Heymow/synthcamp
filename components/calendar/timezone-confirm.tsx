'use client';

import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

const WORLD_ZONES = [
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
] as const;

export interface TimezoneConfirmProps {
  scheduledAt: Date;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TimezoneConfirm({ scheduledAt, onConfirm, onCancel }: TimezoneConfirmProps) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <GlassPanel className="w-full max-w-md space-y-4 p-6">
        <h3 className="text-lg font-bold italic text-white">Confirm slot</h3>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Your timezone ({localTz})
          </p>
          <p className="font-mono text-lg text-indigo-400">
            {scheduledAt.toLocaleString('en-US', {
              timeZone: localTz,
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="space-y-1 border-t border-white/5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            World equivalents
          </p>
          {WORLD_ZONES.map((z) => (
            <div key={z.tz} className="flex justify-between text-xs">
              <span className="text-white/70">{z.label}</span>
              <span className="font-mono text-white">
                {scheduledAt.toLocaleString('en-US', {
                  timeZone: z.tz,
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="md" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} className="flex-1">
            Confirm
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
