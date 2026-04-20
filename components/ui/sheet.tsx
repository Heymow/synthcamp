'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  side?: 'left' | 'right';
  title?: string;
}

export function Sheet({ open, onOpenChange, children, side = 'left', title = 'Menu' }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 z-[70] w-72 border-white/10 bg-[#050507]/90 backdrop-blur-3xl',
            side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            side === 'left'
              ? 'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
              : 'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            'data-[state=open]:shadow-[20px_0_60px_rgba(0,0,0,0.8)]',
          )}
          aria-label={title}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
