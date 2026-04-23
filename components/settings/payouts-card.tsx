'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

interface PayoutsCardProps {
  hasAccount: boolean;
  payoutEnabled: boolean;
}

export function PayoutsCard({ hasAccount, payoutEnabled }: PayoutsCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/artist/stripe/connect', { method: 'POST' });
    if (!res.ok) {
      setLoading(false);
      const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as {
        error?: string;
      };
      setError(body.error ?? 'Request failed');
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  const label = payoutEnabled
    ? 'Update payout details'
    : hasAccount
      ? 'Continue Stripe setup'
      : 'Set up payouts';

  return (
    <GlassPanel className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold italic text-white">Payouts</h3>
          <p className="text-xs text-white/60">
            {payoutEnabled
              ? 'Stripe Connect is active.'
              : 'Connect a Stripe account to receive sales payouts (Phase 3).'}
          </p>
        </div>
        {payoutEnabled && (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Ready
          </span>
        )}
      </div>

      <Button
        variant={payoutEnabled ? 'ghost' : 'primary'}
        size="sm"
        onClick={start}
        disabled={loading}
      >
        {loading ? 'Redirecting…' : label}
      </Button>

      {error && <p className="text-[10px] italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
