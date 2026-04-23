'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import type { WizardState } from './types';

interface StepPublishProps {
  state: WizardState;
  onBack: () => void;
}

export function StepPublish({ state, onBack }: StepPublishProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = state.tracks.reduce((sum, t) => sum + t.duration_seconds, 0);
  const mm = Math.floor(totalDuration / 60);
  const ss = (totalDuration % 60).toString().padStart(2, '0');

  const submit = async () => {
    if (!state.releaseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: {
        party?: { room_id: string; scheduled_at: string };
        release_date?: string;
      } = {};
      if (state.party.enabled && state.party.roomId && state.party.scheduledAt) {
        body.party = { room_id: state.party.roomId, scheduled_at: state.party.scheduledAt };
      } else if (state.releaseDate.mode === 'future' && state.releaseDate.date) {
        body.release_date = state.releaseDate.date;
      }
      // if immediate: body stays empty — the API sets release_date=now() and status=published

      const res = await fetch(`/api/releases/${state.releaseId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({ error: 'Publish failed' }))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? 'Publish failed');
      }
      router.push('/artist/catalog');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassPanel className="space-y-4 p-6">
      <h3 className="text-lg font-bold italic text-white">Ready to publish?</h3>

      <dl className="space-y-2 text-sm">
        <Row label="Title" value={state.title} />
        <Row label="Tracks" value={`${state.tracks.length} (${mm}:${ss})`} />
        <Row label="Format" value={getReleaseLabel(state.tracks.length)} />
        <Row label="Min price" value={`$${getPrice(state.tracks.length)}`} />
        <Row
          label="Credits"
          value={`${state.credits.category} ${state.credits.tags.length > 0 ? `(${state.credits.tags.join(', ')})` : ''}`}
        />
        {state.party.enabled && state.party.scheduledAt && (
          <Row
            label="Party"
            value={new Date(state.party.scheduledAt).toLocaleString('en-US', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          />
        )}
        {!state.party.enabled && state.releaseDate.mode === 'immediate' && (
          <Row label="Release" value="Immediate" />
        )}
        {!state.party.enabled &&
          state.releaseDate.mode === 'future' &&
          state.releaseDate.date && (
            <Row
              label="Release"
              value={new Date(state.releaseDate.date).toLocaleString('en-US', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            />
          )}
      </dl>

      {error && <p className="text-xs italic text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="md" onClick={onBack} className="flex-1">
          ← Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => void submit()}
          disabled={submitting}
          className="flex-1"
        >
          {submitting ? 'Publishing...' : 'Publish'}
        </Button>
      </div>
    </GlassPanel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</dt>
      <dd className="text-right text-sm text-white">{value}</dd>
    </div>
  );
}
