'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface BanUserButtonProps {
  userId: string;
  userName: string;
  initiallyBanned: boolean;
  /** Optional: the reason already on record (shown while confirming unban). */
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
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={unbanUser}
          disabled={isPending}
        >
          {isPending ? 'Unbanning…' : 'Unban user'}
        </Button>
        {initialReason && (
          <span className="text-[10px] italic text-white/50">Reason: {initialReason}</span>
        )}
        {error && <span className="text-[10px] italic text-red-400">{error}</span>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        className="border border-red-500/30 text-red-300 hover:bg-red-500/20"
      >
        Ban user
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
        Ban {userName}?
      </p>
      <p className="text-[10px] italic text-white/60">
        Archives every release, cancels every scheduled party, hides the
        profile from all non-admin viewers. Reversible, but releases and
        parties don&apos;t come back on their own.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Reason (visible to other admins)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setReason('');
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={banUser}
          disabled={isPending}
          className="bg-red-500 text-white hover:bg-red-400"
        >
          {isPending ? 'Banning…' : 'Confirm ban'}
        </Button>
      </div>
      {error && <p className="text-[10px] italic text-red-400">{error}</p>}
    </div>
  );
}
