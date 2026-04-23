'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { ReportTargetType } from '@/lib/database.types';

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}

export function ReportButton({ targetType, targetId, label = 'Report' }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: 'Failed' }))) as {
        error?: string;
      };
      setStatus('error');
      if (res.status === 401) {
        setError('Sign in to report');
      } else {
        setError(body.error ?? 'Failed');
      }
      return;
    }
    setStatus('sent');
    setTimeout(() => {
      setOpen(false);
      setReason('');
      setStatus('idle');
    }, 1400);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/80"
      >
        <Flag size={12} />
        {label}
      </button>
    );
  }

  return (
    <GlassPanel className="space-y-3 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Report</p>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          required
          minLength={1}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's wrong with this content?"
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          disabled={status === 'sending' || status === 'sent'}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              setReason('');
              setStatus('idle');
              setError(null);
            }}
            disabled={status === 'sending'}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={status === 'sending' || status === 'sent' || reason.trim().length === 0}
          >
            {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Submitted ✓' : 'Submit'}
          </Button>
        </div>
        {error && <p className="text-[10px] italic text-red-400">{error}</p>}
      </form>
    </GlassPanel>
  );
}
