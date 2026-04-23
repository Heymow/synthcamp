'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LocalDateTime } from '@/components/ui/local-datetime';
import type { ReportStatus, ReportTargetType } from '@/lib/database.types';

interface ReportRowProps {
  id: string;
  targetType: ReportTargetType;
  targetLabel: string;
  targetSublabel?: string;
  targetHref?: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporterName: string;
  reporterHref?: string;
  /** Total reports from this reporter that have been dismissed. */
  reporterDismissed: number;
}

export function ReportRow({
  id,
  targetType,
  targetLabel,
  targetSublabel,
  targetHref,
  reason,
  status,
  createdAt,
  reporterName,
  reporterHref,
  reporterDismissed,
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

  const targetInner = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold italic text-white">{targetLabel}</p>
      {targetSublabel && (
        <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/50">
          {targetSublabel}
        </p>
      )}
    </div>
  );

  return (
    <GlassPanel className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-300">
            {targetType}
          </span>
          {targetHref ? (
            <Link href={targetHref} className="min-w-0 flex-1 hover:opacity-80" target="_blank">
              {targetInner}
            </Link>
          ) : (
            targetInner
          )}
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ' +
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
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm text-white/90">
        {reason}
      </div>
      <p className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
        <span>
          Reported by{' '}
          {reporterHref ? (
            <Link
              href={reporterHref}
              target="_blank"
              className="text-indigo-300 hover:text-indigo-200"
            >
              {reporterName}
            </Link>
          ) : (
            <span className="text-white/80">{reporterName}</span>
          )}
        </span>
        {reporterDismissed > 0 && (
          <span
            className={
              'rounded-full px-2 py-0.5 font-bold uppercase tracking-widest ' +
              (reporterDismissed >= 3
                ? 'bg-red-500/20 text-red-300'
                : 'bg-amber-500/20 text-amber-300')
            }
            title={`${reporterDismissed} prior report${reporterDismissed === 1 ? '' : 's'} dismissed`}
          >
            {reporterDismissed} dismissed
          </span>
        )}
        <span>·</span>
        <LocalDateTime iso={createdAt} showTimezone={false} />
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
