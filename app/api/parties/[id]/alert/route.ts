import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

async function requireUser(request: NextRequest, partyId: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      err: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }
  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return { supabase, user, err: suspended };
  const limited = enforceLimit(`user:${user.id}:alert:${partyId}`, 30, 60);
  if (limited) return { supabase, user, err: limited };
  return { supabase, user, err: null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, err } = await requireUser(request, id);
  if (err) return err;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: party } = await supabase
    .from('listening_parties')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  if (party.status !== 'scheduled') {
    return NextResponse.json({ error: 'Party is not scheduled' }, { status: 400 });
  }

  const { error } = await supabase
    .from('party_alerts')
    .insert({ party_id: id, user_id: user.id });
  if (error && !/duplicate key/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, subscribed: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, err } = await requireUser(request, id);
  if (err) return err;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { error } = await supabase
    .from('party_alerts')
    .delete()
    .eq('party_id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, subscribed: false });
}
