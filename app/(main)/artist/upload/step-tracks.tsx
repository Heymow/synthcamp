'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { WizardState, WizardTrack } from './types';

interface StepTracksProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  onBack: () => void;
}

function extractDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read audio metadata'));
    };
    audio.src = url;
  });
}

export function StepTracks({ state, setState, onNext, onBack }: StepTracksProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addTrack = async (file: File) => {
    if (!state.releaseId) {
      setError('Missing release (go back to step 1)');
      return;
    }
    setError(null);
    const uiKey = crypto.randomUUID();
    setUploading(uiKey);
    try {
      const durationSeconds = await extractDurationSeconds(file);
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
      const trackNumber = state.tracks.length + 1;

      // Create the track row first (so we have an id for the signed URL)
      const createRes = await fetch(`/api/releases/${state.releaseId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: defaultTitle,
          track_number: trackNumber,
          duration_seconds: durationSeconds,
        }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => ({ error: 'Create failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Create failed');
      }
      const { id: trackId } = (await createRes.json()) as { id: string };

      // Signed URL for R2
      const urlRes = await fetch(`/api/tracks/${trackId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!urlRes.ok) {
        const body = (await urlRes.json().catch(() => ({ error: 'Signed URL failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Signed URL failed');
      }
      const { signed_url, key } = (await urlRes.json()) as { signed_url: string; key: string };

      // Upload to R2
      const put = await fetch(signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      });
      if (!put.ok) throw new Error('Audio upload failed');

      // Patch track row with audio_source_key
      await fetch(`/api/releases/${state.releaseId}/tracks/${trackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_source_key: key }),
      });

      const newTrack: WizardTrack = {
        uiKey,
        id: trackId,
        title: defaultTitle,
        duration_seconds: durationSeconds,
        audio_source_key: key,
        track_number: trackNumber,
      };
      setState((prev) => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const removeTrack = async (track: WizardTrack) => {
    if (!state.releaseId || !track.id) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/releases/${state.releaseId}/tracks/${track.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Delete failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Delete failed');
      }
      setState((prev) => ({
        ...prev,
        tracks: prev.tracks
          .filter((t) => t.uiKey !== track.uiKey)
          .map((t, i) => ({ ...t, track_number: i + 1 })),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const renameTrack = async (track: WizardTrack, newTitle: string) => {
    if (!state.releaseId || !track.id) return;
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.uiKey === track.uiKey ? { ...t, title: newTitle } : t)),
    }));
    // Debounce would be nicer but MVP: fire-and-forget
    await fetch(`/api/releases/${state.releaseId}/tracks/${track.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  const canProceed = state.tracks.length >= 3;

  return (
    <GlassPanel className="space-y-5 p-6">
      <p className="text-sm text-white/80">
        Minimum 3 tracks. EP: 3-5 tracks. Album: 6+ tracks.
      </p>

      <div className="space-y-2">
        {state.tracks.map((t) => {
          const mm = Math.floor(t.duration_seconds / 60);
          const ss = (t.duration_seconds % 60).toString().padStart(2, '0');
          return (
            <div key={t.uiKey} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="w-6 font-mono text-sm text-white/50">
                {t.track_number.toString().padStart(2, '0')}
              </span>
              <input
                type="text"
                value={t.title}
                onChange={(e) => void renameTrack(t, e.target.value)}
                className="flex-1 rounded border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                maxLength={100}
              />
              <span className="font-mono text-xs text-white/60">
                {mm}:{ss}
              </span>
              <button
                type="button"
                onClick={() => void removeTrack(t)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Add a track
        </span>
        <input
          type="file"
          accept="audio/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await addTrack(file);
              e.target.value = '';
            }
          }}
          disabled={uploading !== null}
          className="block w-full text-xs text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:text-white hover:file:bg-white/20"
        />
        {uploading && <p className="text-xs italic text-white/60">Uploading...</p>}
      </label>

      {error && <p className="text-xs italic text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="md" onClick={onBack} className="flex-1">
          ← Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!canProceed || uploading !== null}
          className="flex-1"
        >
          Next → ({state.tracks.length}/3 min)
        </Button>
      </div>
    </GlassPanel>
  );
}
