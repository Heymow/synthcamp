import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportStatus } from '@/lib/database.types';

const VALID_STATUSES: ReportStatus[] = ['open', 'reviewed', 'dismissed'];

interface PatchBody {
  status?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || !body.status || !VALID_STATUSES.includes(body.status as ReportStatus)) {
    return NextResponse.json({ error: 'status required (open|reviewed|dismissed)' }, { status: 400 });
  }

  const { error } = await supabase
    .from('reports')
    .update({ status: body.status as ReportStatus })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
