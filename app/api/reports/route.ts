import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import type { ReportTargetType } from '@/lib/database.types';

const VALID_TARGETS: ReportTargetType[] = ['release', 'profile', 'party', 'track'];

interface CreateReportBody {
  target_type?: string;
  target_id?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:report`, 3, 3600);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as CreateReportBody | null;
  if (!body || !body.target_type || !body.target_id || !body.reason) {
    return NextResponse.json(
      { error: 'target_type, target_id, reason required' },
      { status: 400 },
    );
  }
  if (!VALID_TARGETS.includes(body.target_type as ReportTargetType)) {
    return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 });
  }
  const reason = body.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    return NextResponse.json({ error: 'Reason must be 1-500 chars' }, { status: 400 });
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: body.target_type as ReportTargetType,
    target_id: body.target_id,
    reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
