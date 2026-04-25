import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { getPrice } from '@/lib/pricing';

interface CreatePartyBody {
  release_id?: string;
  room_id?: string;
  scheduled_at?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:party:create`, 5, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as CreatePartyBody | null;
  if (!body || !body.release_id || !body.room_id || !body.scheduled_at) {
    return NextResponse.json(
      { error: 'release_id, room_id, scheduled_at required' },
      { status: 400 },
    );
  }

  // Compute price_minimum the same way /api/releases/[id]/publish does —
  // the RPC now writes price + status + release_date in a single UPDATE,
  // so callers must supply it.
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id')
    .eq('release_id', body.release_id);
  const priceMinimum = parseFloat(getPrice(tracks?.length ?? 0));

  const { data: partyId, error } = await supabase.rpc('validate_and_create_listening_party', {
    p_release_id: body.release_id,
    p_room_id: body.room_id,
    p_scheduled_at: body.scheduled_at,
    p_price_minimum: priceMinimum,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ party_id: partyId }, { status: 201 });
}
