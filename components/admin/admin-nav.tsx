'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/reports', label: 'Reports' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'cursor-pointer rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition',
              active
                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
