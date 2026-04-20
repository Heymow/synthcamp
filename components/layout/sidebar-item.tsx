'use client';

import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

export interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-5 px-8 py-5 transition-all',
        active
          ? 'border-l-4 border-indigo-500 bg-white/5 text-white'
          : 'text-white/60 hover:bg-white/[0.02] hover:text-white/80',
      )}
    >
      <div className={cn(active ? 'text-indigo-400' : '')}>{icon}</div>
      <span className="text-xs font-black tracking-[0.25em] uppercase">{label}</span>
    </button>
  );
}
