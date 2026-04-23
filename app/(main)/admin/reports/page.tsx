import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { AdminNav } from '@/components/admin/admin-nav';
import { ReportRow } from '@/components/admin/report-row';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enrichReportTargets } from '@/lib/admin/enrich-reports';
import type { ReportStatus, ReportTargetType } from '@/lib/database.types';

interface ReportQueryRow {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter_id: string;
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
  const filter: ReportStatus =
    status === 'reviewed' || status === 'dismissed' ? status : 'open';

  const supabase = await getSupabaseServerClient();
  const { data: reportsRaw } = await supabase
    .from('reports')
    .select(
      `id, target_type, target_id, reason, status, created_at, reporter_id,
       reporter:profiles!reports_reporter_id_fkey(display_name)`,
    )
    .eq('status', filter)
    .order('created_at', { ascending: false })
    .limit(50);
  const reports = (reportsRaw ?? []) as unknown as ReportQueryRow[];
  const targets = await enrichReportTargets(supabase, reports);

  // Count prior dismissed reports per reporter in this batch — an abuse
  // signal the admin can factor into their decision.
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
  const dismissCount = new Map<string, number>();
  if (reporterIds.length > 0) {
    const { data: dismissed } = await supabase
      .from('reports')
      .select('reporter_id')
      .eq('status', 'dismissed')
      .in('reporter_id', reporterIds);
    for (const row of dismissed ?? []) {
      dismissCount.set(row.reporter_id, (dismissCount.get(row.reporter_id) ?? 0) + 1);
    }
  }

  const filters: Array<{ key: ReportStatus; label: string }> = [
    { key: 'open', label: 'Open' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <main className="view-enter mx-auto max-w-2xl space-y-6 px-6 pb-32">
      <div>
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          Admin
        </h2>
        <p className="mt-2 text-xs italic text-white/60">Moderation queue.</p>
      </div>

      <AdminNav />

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
          {reports.map((r) => {
            const t = targets[r.id];
            return (
              <ReportRow
                key={r.id}
                id={r.id}
                targetType={r.target_type}
                targetLabel={t?.label ?? 'Target not found'}
                targetSublabel={t?.sublabel}
                targetHref={t?.href}
                reason={r.reason}
                status={r.status}
                createdAt={r.created_at}
                reporterName={r.reporter?.display_name ?? 'Unknown'}
                reporterDismissed={dismissCount.get(r.reporter_id) ?? 0}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
