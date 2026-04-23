'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { cn } from '@/lib/cn';
import type { CreditCategory } from '@/lib/database.types';
import type { WizardState } from './types';

interface StepCreditsProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  onBack: () => void;
}

const CATEGORIES: Array<{ value: CreditCategory; label: string; emoji: string }> = [
  { value: 'acoustic', label: 'Acoustic', emoji: '🌱' },
  { value: 'hybrid', label: 'Hybrid', emoji: '✨' },
  { value: 'ai_crafted', label: 'AI-Crafted', emoji: '🎨' },
];

const TAG_OPTIONS = [
  'melody',
  'lyrics',
  'vocals',
  'arrangement',
  'mastering',
  'stems',
  'production',
];

export function StepCredits({ state, setState, onNext, onBack }: StepCreditsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setState((prev) => ({
      ...prev,
      credits: {
        ...prev.credits,
        tags: prev.credits.tags.includes(tag)
          ? prev.credits.tags.filter((t) => t !== tag)
          : [...prev.credits.tags, tag],
      },
    }));
  };

  const setCategory = (category: CreditCategory) => {
    setState((prev) => ({ ...prev, credits: { ...prev.credits, category } }));
  };

  const submit = async () => {
    if (!state.releaseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/releases/${state.releaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_category: state.credits.category,
          credit_tags: state.credits.tags,
          credit_narrative: state.credits.narrative || null,
          credits_per_track: state.credits.perTrack,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Failed to update credits');
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassPanel className="space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Creative process
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-1 rounded-xl p-3 text-xs font-bold uppercase tracking-widest transition',
                state.credits.category === c.value
                  ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                  : 'bg-white/5 text-white/60 hover:bg-white/10',
              )}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Human craft (optional)
        </p>
        <p className="text-xs text-white/60">
          Tick anything you did yourself, outside AI tooling. Helps listeners see your
          contribution.
        </p>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => {
            const selected = state.credits.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'cursor-pointer rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition',
                  selected
                    ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                    : 'bg-white/5 text-white/60 hover:bg-white/10',
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Your process in a few words (optional, 280 chars)
        </span>
        <textarea
          value={state.credits.narrative}
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              credits: { ...prev.credits, narrative: e.target.value },
            }))
          }
          maxLength={280}
          rows={3}
          placeholder="&quot;Recorded live with 2 modular synths, mastered with Suno v4...&quot;"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
        />
        <span className="block text-right text-[9px] text-white/40">
          {state.credits.narrative.length}/280
        </span>
      </label>

      {error && <p className="text-xs italic text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="md" onClick={onBack} className="flex-1">
          ← Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => void submit()}
          disabled={submitting}
          className="flex-1"
        >
          {submitting ? 'Saving...' : 'Next →'}
        </Button>
      </div>
    </GlassPanel>
  );
}
