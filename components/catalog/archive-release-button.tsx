'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ArchiveReleaseButtonProps {
  releaseId: string;
  releaseTitle: string;
}

export function ArchiveReleaseButton({ releaseId, releaseTitle }: ArchiveReleaseButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const doArchive = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/releases/${releaseId}/archive`, { method: 'POST' });
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        className="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-red-400"
      >
        Archive
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.preventDefault()}
      className="flex flex-col items-end gap-1 text-[9px]"
    >
      <span className="max-w-[180px] text-right font-bold uppercase tracking-widest text-white/60">
        Archive &quot;{releaseTitle}&quot;?
      </span>
      <span className="max-w-[180px] text-right text-[8px] normal-case italic text-white/40">
        Hides from public view. Scheduled party is cancelled. Files stay on disk.
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="cursor-pointer font-bold uppercase tracking-widest text-white/60 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            doArchive();
          }}
          disabled={isPending}
          className="cursor-pointer font-bold uppercase tracking-widest text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {isPending ? 'Archiving…' : 'Confirm'}
        </button>
      </div>
      {error && <span className="italic text-red-400">{error}</span>}
    </div>
  );
}
