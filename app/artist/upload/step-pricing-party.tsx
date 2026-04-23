'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { CalendarPicker } from '@/components/calendar/calendar-picker';
import { TimezoneConfirm } from '@/components/calendar/timezone-confirm';
import { getPrice } from '@/lib/pricing';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import type { Database } from '@/lib/database.types';
import type { WizardState } from './types';

type Room = Database['public']['Tables']['rooms']['Row'];

interface StepPricingPartyProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  onBack: () => void;
}

export function StepPricingParty({ state, setState, onNext, onBack }: StepPricingPartyProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [picked, setPicked] = useState<Date | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .order('display_order', { ascending: true });
      setRooms(data ?? []);
    };
    void load();
  }, []);

  const totalDuration = state.tracks.reduce((sum, t) => sum + t.duration_seconds, 0);
  const priceMin = getPrice(state.tracks.length);

  const togglePartyEnabled = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      party: {
        ...prev.party,
        enabled,
        roomId: enabled ? prev.party.roomId : null,
        scheduledAt: enabled ? prev.party.scheduledAt : null,
      },
    }));
  };

  const pickRoom = (roomId: string) => {
    setState((prev) => ({ ...prev, party: { ...prev.party, roomId, scheduledAt: null } }));
  };

  const onSlotPick = (date: Date) => setPicked(date);

  const confirmSlot = () => {
    if (!picked) return;
    setState((prev) => ({ ...prev, party: { ...prev.party, scheduledAt: picked.toISOString() } }));
    setPicked(null);
  };

  const cancelSlot = () => setPicked(null);

  const canProceed = state.party.enabled
    ? Boolean(state.party.roomId && state.party.scheduledAt)
    : state.releaseDate.mode === 'immediate' ||
      (state.releaseDate.mode === 'future' && Boolean(state.releaseDate.date));

  return (
    <GlassPanel className="space-y-5 p-6">
      <div className="space-y-2 rounded-xl bg-white/[0.03] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Minimum price
        </p>
        <p className="font-mono text-3xl font-black text-indigo-400">${priceMin}</p>
        <p className="text-xs italic text-white/60">
          Formula: ceil({state.tracks.length} × 0.60) − 0.01. Listeners can pay more (tip).
        </p>
      </div>

      <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
        <input
          type="checkbox"
          checked={state.party.enabled}
          onChange={(e) => togglePartyEnabled(e.target.checked)}
          className="accent-indigo-500"
        />
        <span className="text-sm text-white/90">Schedule a listening party</span>
      </label>

      {state.party.enabled ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
              Choose a room
            </p>
            <div className="grid grid-cols-3 gap-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => pickRoom(room.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl p-3 text-[10px] font-bold uppercase tracking-widest transition',
                    state.party.roomId === room.id
                      ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                      : 'bg-white/5 text-white/60 hover:bg-white/10',
                  )}
                >
                  <span>{room.name}</span>
                  {room.kind === 'global_master' && (
                    <span className="text-[8px] font-normal text-indigo-400">Premium</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {state.party.roomId && (
            <CalendarPicker
              roomId={state.party.roomId}
              durationSeconds={totalDuration}
              onPick={onSlotPick}
            />
          )}

          {state.party.scheduledAt && (
            <p className="rounded-xl bg-indigo-500/10 p-3 text-xs text-indigo-300">
              Party scheduled for{' '}
              {new Date(state.party.scheduledAt).toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Release</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="radio"
                checked={state.releaseDate.mode === 'immediate'}
                onChange={() =>
                  setState((prev) => ({
                    ...prev,
                    releaseDate: { mode: 'immediate', date: null },
                  }))
                }
                className="accent-indigo-500"
              />
              Immediate
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="radio"
                checked={state.releaseDate.mode === 'future'}
                onChange={() =>
                  setState((prev) => ({
                    ...prev,
                    releaseDate: { mode: 'future', date: prev.releaseDate.date },
                  }))
                }
                className="accent-indigo-500"
              />
              Future date
            </label>
          </div>
          {state.releaseDate.mode === 'future' && (
            <input
              type="datetime-local"
              value={state.releaseDate.date ? state.releaseDate.date.slice(0, 16) : ''}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  releaseDate: {
                    mode: 'future',
                    date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  },
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="md" onClick={onBack} className="flex-1">
          ← Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1"
        >
          Next →
        </Button>
      </div>

      {picked && (
        <TimezoneConfirm scheduledAt={picked} onConfirm={confirmSlot} onCancel={cancelSlot} />
      )}
    </GlassPanel>
  );
}
