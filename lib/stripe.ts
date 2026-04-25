// Minimal Stripe REST client. Avoids pulling the full stripe npm package
// for now (phase 2 only needs Connect Express account creation + onboarding
// links). Phase 3 may swap to the official SDK when webhook signature
// verification is required.

import Stripe from 'stripe';

const STRIPE_API = 'https://api.stripe.com/v1';

function secret(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

export function isStripeConfigured(): boolean {
  return Boolean(secret());
}

function encodeForm(data: Record<string, string | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

async function stripePost<T>(path: string, body: Record<string, string | boolean | undefined>) {
  const key = secret();
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeForm(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err.error?.message ?? `Stripe ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function createExpressAccount(email: string): Promise<string> {
  // Direct charges require card_payments AND transfers on the connected
  // account: card_payments lets the connected account accept buyer charges,
  // transfers lets the platform pull application_fee_amount on each charge.
  const result = await stripePost<{ id: string }>('/accounts', {
    type: 'express',
    email,
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
  });
  return result.id;
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const result = await stripePost<{ url: string }>('/account_links', {
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });
  return result.url;
}

let cachedClient: Stripe | null = null;

/**
 * Returns the official Stripe SDK client (singleton). Used for Checkout
 * Sessions, webhook signature validation, account retrieval, and refunds.
 * The legacy REST shim above is still used by the Connect onboarding flow
 * — both can coexist.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const key = secret();
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cachedClient = new Stripe(key);
  return cachedClient;
}
