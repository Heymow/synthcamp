'use client';

import { useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
} from '@stripe/react-connect-js';

interface Props {
  /** Which Stripe component to render. */
  mode: 'onboarding' | 'management';
  /** Called when the embedded UI raises onExit (only fires for onboarding). */
  onExit?: () => void;
}

/**
 * Renders Stripe's embedded Connect components inside SynthCamp. The fetch
 * callback hits /api/stripe/account-sessions, which authenticates the user,
 * bootstraps their connected account if missing, and returns a fresh
 * client_secret with both account_onboarding and account_management
 * components enabled. The parent picks which component to mount based on
 * payout_enabled state.
 */
export function EmbeddedConnect({ mode, onExit }: Props) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const [stripeConnectInstance] = useState(() => {
    if (!publishableKey) return null;
    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const res = await fetch('/api/stripe/account-sessions', {
          method: 'POST',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `AccountSession failed (${res.status})`);
        }
        const { client_secret } = (await res.json()) as { client_secret: string };
        return client_secret;
      },
      // Force an explicit light theme on the embedded form so it lives on a
      // white card regardless of the parent page background. Stripe's
      // defaults use medium-contrast grays that wash out on either pure
      // dark or pure light parents.
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#000000',
          colorBackground: '#ffffff',
          colorText: '#0a0a0a',
          colorSecondaryText: '#404040',
          fontFamily: 'inherit',
          borderRadius: '8px',
        },
      },
    });
  });

  if (!publishableKey) {
    return (
      <p className="text-xs italic text-red-400">
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set
      </p>
    );
  }
  if (!stripeConnectInstance) return null;

  return (
    <div className="rounded-lg bg-white p-4 text-neutral-900">
      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        {mode === 'onboarding' ? (
          <ConnectAccountOnboarding
            onExit={() => {
              if (onExit) onExit();
            }}
          />
        ) : (
          <ConnectAccountManagement />
        )}
      </ConnectComponentsProvider>
    </div>
  );
}
