import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';
import type { Json } from '@/lib/database.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // need raw body access

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const sig = (await headers()).get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  // Raw body required for signature verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Idempotency with retry-safety: try to insert the event. If 23505, look
  // up the existing row — only short-circuit if it's been processed. If a
  // previous attempt's handler threw, processed_at is null and we re-run.
  // This avoids permanent loss when the first attempt fails.
  const { error: insertErr } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Json });
  if (insertErr) {
    if (insertErr.code === '23505') {
      const { data: existing } = await supabase
        .from('stripe_events')
        .select('processed_at')
        .eq('id', event.id)
        .single();
      if (existing?.processed_at) {
        return NextResponse.json({ received: true, deduped: true });
      }
      // First attempt failed; this is Stripe's retry. Fall through to
      // re-execute the handler.
    } else {
      console.error('[webhook] event ledger insert failed:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSessionCompleted(
          supabase,
          event.data.object as Stripe.Checkout.Session,
          event.account ?? null,
        );
        break;
      case 'checkout.session.expired':
        // No API retrieves needed; row lookup is by session.id which is
        // globally unique across platform + connected accounts.
        await handleSessionExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded':
        // Charge.id is globally unique; the purchases-table lookup by
        // stripe_charge_id needs no account context.
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;
      case 'account.updated':
        // Platform-origin event keyed by account.id; no stripeAccount needed.
        await handleAccountUpdated(supabase, event.data.object as Stripe.Account);
        break;
      default:
        // Ignore other events; ledger entry serves as audit.
        break;
    }
    await supabase.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhook] handler for ${event.type} failed:`, err);
    // Return 500 so Stripe retries. The ledger row stays unprocessed
    // (processed_at IS NULL), and the dedupe block above re-runs the
    // handler on the next retry instead of short-circuiting.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}

async function handleSessionCompleted(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null,
): Promise<void> {
  // Resolve the charge id by retrieving the PaymentIntent. Under direct
  // charges, the PI lives on the connected account, so we MUST pass
  // stripeAccount on the retrieve call. Without it Stripe returns 404
  // (the platform account doesn't own the PI).
  const stripe = getStripeClient();
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  let chargeId: string | null = null;
  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(
      piId,
      undefined,
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
    );
    chargeId = typeof pi.latest_charge === 'string'
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;
  }

  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'succeeded',
      stripe_payment_intent_id: piId,
      stripe_charge_id: chargeId,
      succeeded_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);
  if (error) throw new Error(`update purchase succeeded: ${error.message}`);
}

async function handleSessionExpired(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Free up the partial unique constraint so the buyer can retry.
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('stripe_session_id', session.id)
    .eq('status', 'pending');
  if (error) throw new Error(`cleanup expired purchase: ${error.message}`);
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  charge: Stripe.Charge,
): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({ status: 'refunded' })
    .eq('stripe_charge_id', charge.id);
  if (error) throw new Error(`mark refunded: ${error.message}`);
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  account: Stripe.Account,
): Promise<void> {
  const payoutEnabled = Boolean(account.charges_enabled && account.payouts_enabled);
  const { error } = await supabase
    .from('profiles_stripe')
    .update({ payout_enabled: payoutEnabled })
    .eq('stripe_account_id', account.id);
  if (error) throw new Error(`update payout_enabled: ${error.message}`);
}
