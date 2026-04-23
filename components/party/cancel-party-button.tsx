'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface CancelPartyButtonProps {
  partyId: string;
}

export function CancelPartyButton({ partyId }: CancelPartyButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const doCancel = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/parties/${partyId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Failed' }))) as { error?: string };
        setError(body.error ?? 'Failed');
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-red-400"
      >
        Cancel party
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[9px] italic text-white/50">
        Cancelling returns release to draft.
      </span>
      <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="cursor-pointer text-white/60 hover:text-white"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={doCancel}
          disabled={isPending}
          className="cursor-pointer text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {isPending ? 'Cancelling…' : 'Confirm cancel'}
        </button>
      </div>
      {error && <span className="text-[9px] italic text-red-400">{error}</span>}
    </div>
  );
}
