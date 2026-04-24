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

type UploadPhase =
  | 'idle'
  | 'reading'
  | 'creating'
  | 'signing'
  | 'uploading'
  | 'finalizing';

const PHASE_LABELS: Record<UploadPhase, string> = {
  idle: 'Choose audio file',
  reading: 'Reading file…',
  creating: 'Creating track…',
  signing: 'Preparing upload…',
  uploading: 'Uploading',
  finalizing: 'Finalizing…',
};

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

function xhrUpload(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(file);
  });
}

export function StepTracks({ state, setState, onNext, onBack }: StepTracksProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addTrack = async (file: File) => {
    if (!state.releaseId) {
      setError('Missing release (go back to step 1)');
      return;
    }
    setError(null);
    const uiKey = crypto.randomUUID();
    setUploading(uiKey);
    setFileLabel(file.name);
    try {
      setPhase('reading');
      const durationSeconds = await extractDurationSeconds(file);
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');

      setPhase('creating');
      const createRes = await fetch(`/api/releases/${state.releaseId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: defaultTitle,
          duration_seconds: durationSeconds,
        }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => ({ error: 'Create failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Create failed');
      }
      const { id: trackId, track_number: trackNumber } = (await createRes.json()) as {
        id: string;
        track_number: number;
      };

      setPhase('signing');
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

      setPhase('uploading');
      setProgress(0);
      await xhrUpload(signed_url, file, file.type || 'audio/mpeg', (pct) => setProgress(pct));

      setPhase('finalizing');
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
      setPhase('idle');
      setProgress(0);
      setFileLabel(null);
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
    await fetch(`/api/releases/${state.releaseId}/tracks/${track.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  const canProceed = state.tracks.length >= 3;
  const isBusy = uploading !== null;

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

      <div className="flex flex-col items-stretch gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Add a track
        </span>
        <label
          className={
            'inline-flex cursor-pointer items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/20 ' +
            (isBusy ? 'pointer-events-none opacity-50' : '')
          }
        >
          {isBusy ? PHASE_LABELS[phase] : PHASE_LABELS.idle}
          <input
            type="file"
            accept="audio/*"
            onChange={async (e) => {
              const input = e.target;
              const file = input.files?.[0];
              input.value = '';
              if (file) await addTrack(file);
            }}
            disabled={isBusy}
            className="sr-only"
          />
        </label>

        {isBusy && (
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/70">
              <span className="truncate pr-2">{fileLabel ?? 'File'}</span>
              <span className="shrink-0 font-mono text-indigo-300">
                {phase === 'uploading' ? `${Math.round(progress)}%` : PHASE_LABELS[phase]}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={
                  'h-full rounded-full bg-indigo-400 transition-[width] duration-150 ' +
                  (phase === 'uploading' ? '' : 'animate-pulse')
                }
                style={{
                  width: phase === 'uploading' ? `${progress}%` : '100%',
                  opacity: phase === 'uploading' ? 1 : 0.4,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs italic text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="md" onClick={onBack} className="flex-1" disabled={isBusy}>
          ← Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!canProceed || isBusy}
          className="flex-1 flex-col !py-2 leading-tight"
        >
          <span>Next →</span>
          <span className="text-[9px] font-bold opacity-70">
            ({state.tracks.length}/3 min)
          </span>
        </Button>
      </div>
    </GlassPanel>
  );
}
