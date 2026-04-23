import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { ReportRow } from '@/components/admin/report-row';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportStatus, ReportTargetType } from '@/lib/database.types';

interface ReportQueryRow {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter: { display_name: string } | null;
}

interface AdminReportsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to access admin" />;
  if (!profile.is_admin) notFound();

  const { status } = await searchParams;
  const filter: ReportStatus | 'all' =
    status === 'reviewed' || status === 'dismissed' || status === 'open'
      ? status
      : 'open';

  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from('reports')
    .select(
      `id, target_type, target_id, reason, status, created_at,
       reporter:profiles!reports_reporter_id_fkey(display_name)`,
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (filter !== 'all') query = query.eq('status', filter);

  const { data: reportsRaw } = await query;
  const reports = (reportsRaw ?? []) as unknown as ReportQueryRow[];

  const filters: Array<{ key: 'open' | 'reviewed' | 'dismissed'; label: string }> = [
    { key: 'open', label: 'Open' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <main className="view-enter mx-auto max-w-2xl space-y-6 px-6 pb-32">
      <div>
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          Reports
        </h2>
        <p className="mt-2 text-xs italic text-white/60">
          Admin-only queue. Mark each report reviewed or dismissed once handled.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/reports?status=${f.key}`}
            className={
              'cursor-pointer rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ' +
              (filter === f.key
                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10')
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm italic text-white/60">No {filter} reports.</p>
        </GlassPanel>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              id={r.id}
              targetType={r.target_type}
              targetId={r.target_id}
              reason={r.reason}
              status={r.status}
              createdAt={r.created_at}
              reporterName={r.reporter?.display_name ?? 'Unknown'}
            />
          ))}
        </div>
      )}
    </main>
  );
}
