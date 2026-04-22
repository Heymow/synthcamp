'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/cn';

const SLOT_MINUTES = 15;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

export interface OccupiedSlot {
  scheduled_at: string;
  ends_at: string;
}

export interface CalendarPickerProps {
  roomId: string;
  durationSeconds: number;
  onPick: (scheduledAt: Date) => void;
}

export function CalendarPicker({ roomId, durationSeconds, onPick }: CalendarPickerProps) {
  const [occupied, setOccupied] = useState<OccupiedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));

  const rangeFrom = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const rangeTo = useMemo(() => addDays(startOfDay(new Date()), 90).toISOString(), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/calendar?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as {
            error?: string;
          };
          setError(body.error ?? 'Failed to load calendar');
          return;
        }
        const data = (await res.json()) as { slots: OccupiedSlot[] };
        setOccupied(data.slots ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [roomId, rangeFrom, rangeTo]);

  if (loading) {
    return <p className="text-sm italic text-white/60">Chargement du calendrier…</p>;
  }
  if (error) {
    return <p className="text-sm italic text-red-400">Erreur : {error}</p>;
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();

  const isSlotAvailable = (slot: Date): boolean => {
    if (isBefore(slot, now)) return false;
    const slotEnd = addMinutes(slot, durationSeconds / 60);
    for (const o of occupied) {
      const oStart = new Date(o.scheduled_at);
      const oEnd = new Date(o.ends_at);
      // Overlap: a.start < b.end && b.start < a.end
      if (slot < oEnd && oStart < slotEnd) return false;
    }
    return true;
  };

  const canGoPrev = weekStart.getTime() > startOfDay(new Date()).getTime();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          disabled={!canGoPrev}
          className="text-xs text-white/60 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        >
          ← Semaine précédente
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          {format(days[0]!, 'dd MMM')} → {format(days[6]!, 'dd MMM')}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="text-xs text-white/60 hover:text-white"
        >
          Semaine suivante →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.toISOString()} className="space-y-1">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/70">
              {format(day, 'EEE dd/MM')}
            </h4>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
                const slot = addMinutes(day, i * SLOT_MINUTES);
                const available = isSlotAvailable(slot);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!available}
                    onClick={() => onPick(slot)}
                    className={cn(
                      'block w-full rounded px-1 py-0.5 text-left font-mono text-[9px]',
                      available
                        ? 'bg-white/5 text-white hover:bg-indigo-500/30'
                        : 'cursor-not-allowed bg-white/[0.02] text-white/20',
                    )}
                  >
                    {format(slot, 'HH:mm')}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
