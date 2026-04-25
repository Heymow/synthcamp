import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err } = await requireAdmin();
  if (err) return err;

  const { id: purchaseId } = await params;

  // Service role for the cross-artist join — defense-in-depth, keeps the
  // refund-route's correctness independent of the profiles_stripe admin
  // SELECT policy staying coupled to the is_admin flag.
  const admin = getSupabaseServiceRoleClient();

  const { data: purchase, error: fetchErr } = await admin
    .from('purchases')
    .select('id, status, stripe_charge_id, release_id')
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

  // Resolve the connected account id via release.artist_id → profiles_stripe.
  const { data: release, error: relErr } = await admin
    .from('releases')
    .select('artist_id')
    .eq('id', purchase.release_id)
    .single();
  if (relErr || !release) {
    return NextResponse.json({ error: 'Release not found for purchase' }, { status: 404 });
  }
  const { data: artistStripe, error: stripeRowErr } = await admin
    .from('profiles_stripe')
    .select('stripe_account_id')
    .eq('profile_id', release.artist_id)
    .maybeSingle();
  if (stripeRowErr || !artistStripe?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Artist Stripe account not found' },
      { status: 409 },
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.refunds.create(
      {
        charge: chargeId,
        // Direct charges: no transfer happened, so no transfer to reverse.
        // The application fee that flowed platform-side at capture is reversed
        // back to the artist on refund.
        refund_application_fee: true,
      },
      { stripeAccount: artistStripe.stripe_account_id },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe refund failed';
    console.error('[admin/refund] stripe.refunds.create failed:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // The webhook charge.refunded fires async on the connected account and
  // flips purchases.status to 'refunded'. We don't update the row here to
  // avoid races.
  return NextResponse.json({ ok: true, refunded_charge: chargeId });
}
