import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
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
  const { supabase, err } = await requireAdmin();
  if (err) return err;

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
