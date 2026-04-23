'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { PartyStatus } from '@/lib/database.types';

// Subscribes to UPDATE events on a specific listening_parties row and returns
// the latest status. Falls back to the server-rendered initial status if
// Realtime isn't available (self-host deployment without the realtime
// container still gets a working page — just without live updates).
export function usePartyStatus(partyId: string, initialStatus: PartyStatus): PartyStatus {
  const [status, setStatus] = useState<PartyStatus>(initialStatus);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`party:${partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'listening_parties',
          filter: `id=eq.${partyId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: PartyStatus }).status;
          if (next) setStatus(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partyId]);

  return status;
}
