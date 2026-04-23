'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface FollowButtonProps {
  artistSlug: string;
  initialFollowing: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function FollowButton({
  artistSlug,
  initialFollowing,
  disabled,
  disabledReason,
}: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (disabled) {
    return (
      <Button variant="ghost" size="sm" disabled title={disabledReason}>
        {disabledReason ?? 'Follow'}
      </Button>
    );
  }

  const toggle = () => {
    const nextState = !following;
    setFollowing(nextState);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/profiles/${artistSlug}/follow`, {
        method: nextState ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setFollowing(!nextState);
        const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as {
          error?: string;
        };
        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        setError(body.error ?? 'Request failed');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={following ? 'ghost' : 'primary'}
        size="sm"
        onClick={toggle}
        disabled={isPending}
      >
        {following ? 'Following' : 'Follow'}
      </Button>
      {error && <span className="text-[10px] italic text-red-400">{error}</span>}
    </div>
  );
}
