'use client';

import { usePartyStatus } from '@/lib/realtime/use-party-status';
import type { PartyStatus } from '@/lib/database.types';

interface LiveStatusProps {
  partyId: string;
  scheduledAt: string;
  initialStatus: PartyStatus;
}

export function LiveStatus({ partyId, scheduledAt, initialStatus }: LiveStatusProps) {
  const status = usePartyStatus(partyId, initialStatus);

  const isLive = status === 'live';

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-400">
        {isLive && (
          <span className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
        {status === 'scheduled' && 'Scheduled for'}
        {status === 'live' && 'Live now'}
        {status === 'ended' && 'Ended'}
        {status === 'cancelled' && 'Cancelled'}
      </p>
      {status !== 'ended' && status !== 'cancelled' && (
        <p className="font-mono text-sm text-white">
          {new Date(scheduledAt).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </p>
      )}
    </div>
  );
}
