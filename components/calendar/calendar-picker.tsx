'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@/lib/cn';

const SLOT_MINUTES = 15;

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
  const today = useMemo(() => startOfDay(new Date()), []);
  const [occupied, setOccupied] = useState<OccupiedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const rangeFrom = useMemo(() => today.toISOString(), [today]);
  const rangeTo = useMemo(() => addDays(today, 90).toISOString(), [today]);

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
    return <p className="text-sm italic text-white/60">Loading calendar…</p>;
  }
  if (error) {
    return <p className="text-sm italic text-red-400">Error: {error}</p>;
  }

  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const canGoPrev = weekStart.getTime() > today.getTime();

  // Count available quarter-hour slots per hour of `selectedDay` so the hour
  // grid can mark fully-booked hours as disabled.
  const hourSlots = Array.from({ length: 24 }, (_, hour) => {
    const hourStart = addMinutes(selectedDay, hour * 60);
    const quarters = Array.from({ length: 4 }, (_, q) => addMinutes(hourStart, q * SLOT_MINUTES));
    const availableCount = quarters.filter(isSlotAvailable).length;
    return { hour, quarters, availableCount };
  });

  const handleDayPick = (day: Date) => {
    setSelectedDay(day);
    setSelectedHour(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          disabled={!canGoPrev}
          className="cursor-pointer rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ← Prev week
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          {format(days[0]!, 'dd MMM')} → {format(days[6]!, 'dd MMM')}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="cursor-pointer rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          Next week →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const isPast = isBefore(day, today);
          const isSelected = isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDayPick(day)}
              disabled={isPast}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-xl py-2 transition disabled:cursor-not-allowed disabled:opacity-30',
                isSelected
                  ? 'bg-indigo-500/30 ring-1 ring-indigo-500/50'
                  : 'bg-white/5 hover:bg-white/10',
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
                {format(day, 'EEE')}
              </span>
              <span
                className={cn(
                  'font-mono text-lg font-black',
                  isSelected ? 'text-indigo-300' : 'text-white',
                )}
              >
                {format(day, 'dd')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            {format(selectedDay, 'EEEE dd MMMM')}
          </p>
          {selectedHour !== null && (
            <button
              type="button"
              onClick={() => setSelectedHour(null)}
              className="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-white"
            >
              ← Pick another hour
            </button>
          )}
        </div>

        {selectedHour === null ? (
          <>
            <p className="text-[9px] italic text-white/40">Pick an hour to see 15-min slots.</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {hourSlots.map(({ hour, availableCount }) => {
                const hasAny = availableCount > 0;
                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => hasAny && setSelectedHour(hour)}
                    disabled={!hasAny}
                    className={cn(
                      'relative flex cursor-pointer flex-col items-center rounded-lg py-2 font-mono text-xs transition disabled:cursor-not-allowed',
                      hasAny
                        ? 'bg-white/5 text-white hover:bg-indigo-500/20'
                        : 'bg-white/[0.02] text-white/20',
                    )}
                  >
                    <span className="font-black">{hour.toString().padStart(2, '0')}h</span>
                    <span className="text-[8px] font-bold tracking-widest text-white/40">
                      {availableCount}/4
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {hourSlots[selectedHour]!.quarters.map((slot) => {
              const available = isSlotAvailable(slot);
              return (
                <button
                  key={slot.toISOString()}
                  type="button"
                  onClick={() => onPick(slot)}
                  disabled={!available}
                  className={cn(
                    'cursor-pointer rounded-lg py-3 font-mono text-sm font-bold transition disabled:cursor-not-allowed',
                    available
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40 hover:bg-indigo-500/40'
                      : 'bg-white/[0.02] text-white/20',
                  )}
                >
                  {format(slot, 'HH:mm')}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[9px] italic text-white/40">
        Greyed-out slots are booked or in the past. Party duration: {Math.floor(durationSeconds / 60)} min.
      </p>
    </div>
  );
}
