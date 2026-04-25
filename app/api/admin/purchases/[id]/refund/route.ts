import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, err } = await requireAdmin();
  if (err) return err;

  const { id: purchaseId } = await params;

  const { data: purchase, error: fetchErr } = await supabase
    .from('purchases')
    .select('id, status, stripe_charge_id, stripe_payment_intent_id')
    .eq('id', purchaseId)
    .single();
  if (fetchErr || !purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }
  if (purchase.status !== 'succeeded') {
    return NextResponse.json(
      { error: `Cannot refund purchase in status '${purchase.status}'` },
      { status: 400 },
    );
  }
  const chargeId = purchase.stripe_charge_id ?? null;
  if (!chargeId) {
    return NextResponse.json({ error: 'No charge id on purchase' }, { status: 400 });
  }

  const stripe = getStripeClient();
  try {
    await stripe.refunds.create({
      charge: chargeId,
      refund_application_fee: true,
      reverse_transfer: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe refund failed';
    console.error('[admin/refund] stripe.refunds.create failed:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // The webhook charge.refunded fires async and flips purchases.status
  // to 'refunded'. We don't update the row here to avoid races.
  return NextResponse.json({ ok: true, refunded_charge: chargeId });
}
