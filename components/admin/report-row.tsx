'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LocalDateTime } from '@/components/ui/local-datetime';
import type { ReportStatus, ReportTargetType } from '@/lib/database.types';

interface ReportRowProps {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporterName: string;
}

export function ReportRow({
  id,
  targetType,
  targetId,
  reason,
  status,
  createdAt,
  reporterName,
}: ReportRowProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<ReportStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (next: ReportStatus) => {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setCurrent(previous);
        const body = (await res.json().catch(() => ({ error: 'Failed' }))) as {
          error?: string;
        };
        setError(body.error ?? 'Failed');
        return;
      }
      router.refresh();
    });
  };

  return (
    <GlassPanel className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">
            {targetType}
          </span>
          <span className="font-mono text-[10px] text-white/40">{targetId.slice(0, 8)}</span>
        </div>
        <span
          className={
            'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ' +
            (current === 'open'
              ? 'bg-red-500/20 text-red-300'
              : current === 'reviewed'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white/50')
          }
        >
          {current}
        </span>
      </div>
      <p className="text-sm text-white">{reason}</p>
      <p className="text-[10px] text-white/50">
        Reported by {reporterName} · <LocalDateTime iso={createdAt} showTimezone={false} />
      </p>
      <div className="flex items-center gap-2 pt-1 text-[10px] font-bold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => update('reviewed')}
          disabled={isPending || current === 'reviewed'}
          className="cursor-pointer rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark reviewed
        </button>
        <button
          type="button"
          onClick={() => update('dismissed')}
          disabled={isPending || current === 'dismissed'}
          className="cursor-pointer rounded-full bg-white/10 px-3 py-1 text-white/70 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => update('open')}
          disabled={isPending || current === 'open'}
          className="cursor-pointer rounded-full bg-red-500/20 px-3 py-1 text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reopen
        </button>
      </div>
      {error && <p className="text-[10px] italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
