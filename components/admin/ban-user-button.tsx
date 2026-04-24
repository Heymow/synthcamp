'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface BanUserButtonProps {
  userId: string;
  userName: string;
  initiallyBanned: boolean;
  /** Optional: the reason already on record (shown as a tooltip). */
  initialReason?: string | null;
}

export function BanUserButton({
  userId,
  userName,
  initiallyBanned,
  initialReason,
}: BanUserButtonProps) {
  const router = useRouter();
  const [banned, setBanned] = useState(initiallyBanned);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const banUser = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Failed' }))) as {
          error?: string;
        };
        setError(body.error ?? 'Failed');
        return;
      }
      setBanned(true);
      setConfirming(false);
      setReason('');
      router.refresh();
    });
  };

  const unbanUser = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/ban`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Failed' }))) as {
          error?: string;
        };
        setError(body.error ?? 'Failed');
        return;
      }
      setBanned(false);
      router.refresh();
    });
  };

  if (banned) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={unbanUser}
          disabled={isPending}
          title={initialReason ? `Reason: ${initialReason}` : undefined}
          className="cursor-pointer rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Unbanning…' : 'Unban'}
        </button>
        {error && <span className="text-[10px] italic text-red-400">{error}</span>}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/30"
      >
        Ban
      </button>
    );
  }

  return (
    <GlassPanel className="space-y-2 border border-red-500/30 bg-red-500/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
        Ban {userName}?
      </p>
      <p className="text-[10px] italic text-white/60">
        Archives every release, cancels scheduled parties, hides the profile.
        Reversible. Unban restores everything.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Reason (shown to other admins)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setReason('');
            setError(null);
          }}
          disabled={isPending}
          className="cursor-pointer rounded-full bg-white/10 px-3 py-1 text-white/70 transition hover:bg-white/20 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={banUser}
          disabled={isPending}
          className="cursor-pointer rounded-full bg-red-500 px-3 py-1 text-white transition hover:bg-red-400 disabled:opacity-40"
        >
          {isPending ? 'Banning…' : 'Confirm ban'}
        </button>
      </div>
      {error && <p className="text-[10px] italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
