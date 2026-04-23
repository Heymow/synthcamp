import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ReportTargetType } from '@/lib/database.types';

export interface ReportTarget {
  label: string;
  sublabel?: string;
  href?: string;
}

/**
 * Batch-resolve a list of reports into human-friendly target descriptions.
 * One DB query per target type, not per report.
 */
export async function enrichReportTargets(
  supabase: SupabaseClient<Database>,
  reports: Array<{ id: string; target_type: ReportTargetType; target_id: string }>,
): Promise<Record<string, ReportTarget>> {
  const byType: Record<ReportTargetType, Set<string>> = {
    release: new Set(),
    profile: new Set(),
    party: new Set(),
    track: new Set(),
  };
  for (const r of reports) byType[r.target_type].add(r.target_id);

  const lookup = new Map<string, ReportTarget>();

  if (byType.release.size > 0) {
    const { data } = await supabase
      .from('releases')
      .select('id, title, slug, artist:profiles!releases_artist_id_fkey(display_name)')
      .in('id', [...byType.release]);
    for (const row of (data as unknown as Array<{
      id: string;
      title: string;
      slug: string;
      artist: { display_name: string } | null;
    }> | null) ?? []) {
      lookup.set(`release:${row.id}`, {
        label: row.title,
        sublabel: row.artist?.display_name ?? 'Unknown artist',
        href: `/r/${row.slug}`,
      });
    }
  }

  if (byType.profile.size > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, slug, is_artist')
      .in('id', [...byType.profile]);
    for (const row of data ?? []) {
      lookup.set(`profile:${row.id}`, {
        label: row.display_name,
        sublabel: row.is_artist ? 'Artist' : 'Listener',
        href: row.slug && row.is_artist ? `/artist/${row.slug}` : undefined,
      });
    }
  }

  if (byType.party.size > 0) {
    const { data } = await supabase
      .from('listening_parties')
      .select(
        'id, scheduled_at, release:releases!listening_parties_release_id_fkey(title), room:rooms(name)',
      )
      .in('id', [...byType.party]);
    for (const row of (data as unknown as Array<{
      id: string;
      scheduled_at: string;
      release: { title: string } | null;
      room: { name: string } | null;
    }> | null) ?? []) {
      lookup.set(`party:${row.id}`, {
        label: row.release?.title ?? 'Untitled party',
        sublabel: row.room?.name ?? 'Unknown room',
        href: `/party/${row.id}`,
      });
    }
  }

  if (byType.track.size > 0) {
    const { data } = await supabase
      .from('tracks')
      .select(
        'id, title, release:releases!tracks_release_id_fkey(title, slug)',
      )
      .in('id', [...byType.track]);
    for (const row of (data as unknown as Array<{
      id: string;
      title: string;
      release: { title: string; slug: string } | null;
    }> | null) ?? []) {
      lookup.set(`track:${row.id}`, {
        label: row.title,
        sublabel: row.release?.title ?? 'Unknown release',
        href: row.release ? `/r/${row.release.slug}` : undefined,
      });
    }
  }

  const result: Record<string, ReportTarget> = {};
  for (const r of reports) {
    const key = `${r.target_type}:${r.target_id}`;
    result[r.id] = lookup.get(key) ?? { label: 'Target not found' };
  }
  return result;
}
