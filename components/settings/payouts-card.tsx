'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmbeddedConnect } from '@/components/stripe/embedded-connect';

interface PayoutsCardProps {
  hasAccount: boolean;
  payoutEnabled: boolean;
}

export function PayoutsCard({ hasAccount, payoutEnabled }: PayoutsCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const label = payoutEnabled
    ? 'Manage payouts'
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
              : 'Connect a Stripe account to receive sales payouts.'}
          </p>
        </div>
        {payoutEnabled && (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Ready
          </span>
        )}
      </div>

      {!open && (
        <Button
          variant={payoutEnabled ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}

      {open && (
        <div className="space-y-3">
          <EmbeddedConnect
            mode={payoutEnabled ? 'management' : 'onboarding'}
            onExit={() => {
              setOpen(false);
              // The account.updated webhook flips payout_enabled; refresh
              // the server component so the ribbon and label catch up.
              router.refresh();
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      )}
    </GlassPanel>
  );
}
