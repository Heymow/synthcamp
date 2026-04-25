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

/**
 * Resolve the target row and check two things at once: does it exist
 * (if not → 404) and does the caller own it (if so → 400, self-report).
 * Returns a NextResponse to short-circuit on either failure, or null to
 * proceed with the insert.
 */
async function checkTarget(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  userId: string,
  targetType: ReportTargetType,
  targetId: string,
): Promise<NextResponse | null> {
  if (targetType === 'profile') {
    if (targetId === userId) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }
    return null;
  }

  if (targetType === 'release') {
    const { data, error } = await supabase
      .from('releases')
      .select('artist_id')
      .eq('id', targetId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }
    if (data.artist_id === userId) {
      return NextResponse.json(
        { error: 'Cannot report your own release' },
        { status: 400 },
      );
    }
    return null;
  }

  if (targetType === 'track') {
    // Ownership flows through the release.
    const { data, error } = await supabase
      .from('tracks')
      .select('release:releases!tracks_release_id_fkey(artist_id)')
      .eq('id', targetId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }
    const rel = (data as unknown as { release: { artist_id: string } | null }).release;
    if (rel && rel.artist_id === userId) {
      return NextResponse.json(
        { error: 'Cannot report your own track' },
        { status: 400 },
      );
    }
    return null;
  }

  // target_type === 'party'
  const { data, error } = await supabase
    .from('listening_parties')
    .select('artist_id')
    .eq('id', targetId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }
  if (data.artist_id === userId) {
    return NextResponse.json(
      { error: 'Cannot report your own party' },
      { status: 400 },
    );
  }
  return null;
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

  // Existence + self-report check in one pass. RLS allows SELECT on the
  // target rows for any authenticated user (releases/profiles/tracks are
  // public; parties are public).
  const targetType = body.target_type as ReportTargetType;
  const targetCheck = await checkTarget(supabase, user.id, targetType, body.target_id);
  if (targetCheck) return targetCheck;

  const { data: inserted, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: body.target_id,
      reason,
    })
    .select('id')
    .single();
  if (error) {
    // 23505 comes from the idx_reports_open_dedupe partial unique index
    // — same reporter already has an open report for this target.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Report already submitted' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fire-and-forget in-app notification to every admin; swallow failures
  // so the reporter still gets a 201 on their submission.
  if (inserted?.id) {
    try {
      await supabase.rpc('notify_admins_of_report', { p_report_id: inserted.id });
    } catch {
      // ignore notif fanout errors — the report itself persisted
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
