'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NotificationKind } from '@/lib/database.types';

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface NotificationsBellProps {
  initialUnread: number;
}

function linkFor(n: NotificationRow): { href: string; label: string } {
  const p = n.payload;
  switch (n.kind) {
    case 'release_published': {
      const slug = typeof p.release_slug === 'string' ? p.release_slug : '';
      const title = typeof p.release_title === 'string' ? p.release_title : 'Release';
      const artist = typeof p.artist_name === 'string' ? p.artist_name : '';
      return {
        href: slug ? `/r/${slug}` : '#',
        label: artist ? `${artist} · ${title}` : title,
      };
    }
    case 'party_scheduled': {
      const id = typeof p.party_id === 'string' ? p.party_id : '';
      return { href: id ? `/party/${id}` : '#', label: 'Upcoming party' };
    }
    case 'follow': {
      const slug = typeof p.follower_slug === 'string' ? p.follower_slug : '';
      return { href: slug ? `/artist/${slug}` : '#', label: 'New follower' };
    }
    case 'report_created': {
      const target = typeof p.target_type === 'string' ? p.target_type : 'content';
      const reason = typeof p.reason === 'string' ? p.reason : '';
      return {
        href: '/admin/reports',
        label: `New report · ${target}${reason ? ` — ${reason}` : ''}`,
      };
    }
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function NotificationsBell({ initialUnread }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch('/api/notifications')
      .then((r) => r.json())
      .then((data: { notifications?: NotificationRow[] }) => {
        if (!cancelled) setItems(data.notifications ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const markAllRead = async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) =>
      prev
        ? prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
        : prev,
    );
    await fetch('/api/notifications/read-all', { method: 'POST' });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 font-mono text-[9px] font-black text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[80] w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#050507]/95 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-8 text-center text-xs italic text-white/60">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs italic text-white/60">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => {
                const { href, label } = linkFor(n);
                const isUnread = !n.read_at;
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/[0.04]',
                      isUnread && 'bg-indigo-500/[0.06]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{label}</span>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-white/50">
                        {n.kind.replace('_', ' ')}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/40">
                      {timeAgo(n.created_at)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
