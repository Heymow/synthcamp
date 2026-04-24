'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

interface DeleteDraftButtonProps {
  releaseId: string;
  releaseTitle: string;
  redirectTo?: string;
}

export function DeleteDraftButton({
  releaseId,
  releaseTitle,
  redirectTo,
}: DeleteDraftButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/releases/${releaseId}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Failed to delete');
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
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
        className="flex cursor-pointer items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/15"
        aria-label={`Delete draft ${releaseTitle}`}
      >
        <Trash2 size={11} />
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={doDelete}
        disabled={deleting}
        className="cursor-pointer rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-red-100 transition hover:bg-red-500/30 disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(false);
          setError(null);
        }}
        className="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80"
      >
        Cancel
      </button>
      {error && <span className="text-[9px] italic text-red-400">{error}</span>}
    </div>
  );
}
