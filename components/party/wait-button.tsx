'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface WaitButtonProps {
  partyId: string;
  initialSubscribed: boolean;
  isAuthenticated: boolean;
  /** Presentational variant — use 'ghost' in compact rows, 'primary' for the hero. */
  variant?: 'primary' | 'ghost';
  className?: string;
}

export function WaitButton({
  partyId,
  initialSubscribed,
  isAuthenticated,
  variant = 'primary',
  className,
}: WaitButtonProps) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    // Prevent the parent Link from navigating to the party page. Clicking the
    // button should only toggle the alert; clicking anywhere else on the card
    // still takes the user to /party/[id].
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    const next = !subscribed;
    setSubscribed(next);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/parties/${partyId}/alert`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setSubscribed(!next);
        const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as {
          error?: string;
        };
        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        setError(body.error ?? 'Request failed');
      }
    });
  };

  const label = subscribed ? 'Waiting' : 'Wait';
  const Icon = subscribed ? BellRing : Bell;

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <Button
        type="button"
        variant={variant}
        size={variant === 'primary' ? 'md' : 'sm'}
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          'flex items-center gap-2',
          variant === 'primary' ? 'w-full md:w-auto' : '',
        )}
      >
        <Icon size={14} />
        {label}
      </Button>
      {error && <span className="text-[9px] italic text-red-400">{error}</span>}
    </div>
  );
}
