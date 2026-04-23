'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { compressImage } from '@/lib/image-compress';
import type { WizardState } from './types';

interface StepMetadataProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  artistId: string;
}

export function StepMetadata({ state, setState, onNext }: StepMetadataProps) {
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genreInput, setGenreInput] = useState('');

  const uploadCoverDirect = async (file: File, releaseId: string) => {
    setUploading(true);
    setError(null);
    try {
      const urlRes = await fetch('/api/covers/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: releaseId, filename: file.name }),
      });
      if (!urlRes.ok) {
        const body = (await urlRes.json().catch(() => ({ error: 'Failed to get signed URL' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Failed to get signed URL');
      }
      const { signed_url, path } = (await urlRes.json()) as {
        signed_url: string;
        path: string;
      };

      // Upload the file via signed URL PUT
      const put = await fetch(signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Cover upload failed');

      // Cover is stored at path in the 'covers' bucket. Public URL:
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/covers/${path}`;

      // Patch release with the public URL
      await fetch(`/api/releases/${releaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_url: publicUrl }),
      });

      setState((prev) => ({ ...prev, coverUrl: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // If no release yet, create it. Cover_url must be non-empty to pass API validation,
      // so we require an uploaded cover first.
      if (!state.releaseId) {
        if (!state.coverUrl) {
          setError('Upload a cover image first');
          setSubmitting(false);
          return;
        }
        const res = await fetch('/api/releases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: state.title,
            description: state.description || null,
            cover_url: state.coverUrl,
            language: state.language || null,
            genres: state.genres,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Failed to create draft');
        }
        const { id, slug } = (await res.json()) as { id: string; slug: string };
        setState((prev) => ({ ...prev, releaseId: id, releaseSlug: slug }));
      } else {
        // PATCH updates
        const res = await fetch(`/api/releases/${state.releaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: state.title,
            description: state.description || null,
            language: state.language || null,
            genres: state.genres,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Failed to update draft');
        }
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const addGenre = () => {
    const v = genreInput.trim().toLowerCase();
    if (!v) return;
    if (state.genres.includes(v)) {
      setGenreInput('');
      return;
    }
    if (state.genres.length >= 5) {
      setError('Max 5 genres');
      return;
    }
    setState((prev) => ({ ...prev, genres: [...prev.genres, v] }));
    setGenreInput('');
  };

  const removeGenre = (g: string) => {
    setState((prev) => ({ ...prev, genres: prev.genres.filter((x) => x !== g) }));
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files?.[0];
    // Reset the input value so re-selecting the same file still triggers onChange
    input.value = '';
    if (!picked) return;

    setError(null);

    if (!state.title.trim()) {
      setError('Enter a title before uploading cover');
      return;
    }

    // Compress client-side so oversized images don't hit the bucket's 10 MB cap
    let file = picked;
    try {
      file = await compressImage(picked);
    } catch {
      // Fall back to raw file; Storage will reject if it's still too large.
    }

    // Ensure a release exists first
    let releaseId = state.releaseId;
    if (!releaseId) {
      const res = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          cover_url: 'https://placehold.co/1200x1200/050507/6366f1.png?text=SynthCamp', // temp
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
          error?: string;
        };
        setError(body.error ?? 'Failed to create draft for cover upload');
        return;
      }
      const data = (await res.json()) as { id: string; slug: string };
      releaseId = data.id;
      setState((prev) => ({ ...prev, releaseId: data.id, releaseSlug: data.slug }));
    }

    await uploadCoverDirect(file, releaseId);
  };

  return (
    <GlassPanel className="space-y-5 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Title *
          </span>
          <input
            type="text"
            required
            value={state.title}
            onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={100}
            placeholder="Aura Genesis"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Description
          </span>
          <textarea
            value={state.description}
            onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
            maxLength={2000}
            rows={3}
            placeholder="Your release in a few words..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Cover *
          </span>
          {state.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.coverUrl}
              alt="cover"
              className="h-40 w-40 rounded-2xl object-cover"
            />
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            disabled={uploading}
            className="block w-full text-xs text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:text-white hover:file:bg-white/20"
          />
          {uploading && <p className="text-xs italic text-white/60">Uploading...</p>}
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Language (ISO 639-1, e.g. fr, en)
          </span>
          <input
            type="text"
            value={state.language}
            onChange={(e) => setState((prev) => ({ ...prev, language: e.target.value }))}
            maxLength={2}
            pattern="[a-z]{2}"
            className="w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Genres (max 5)
          </span>
          <div className="flex flex-wrap gap-2">
            {state.genres.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300"
              >
                {g}
                <button
                  type="button"
                  onClick={() => removeGenre(g)}
                  className="text-indigo-400 hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addGenre();
                }
              }}
              placeholder="electronic, folk, ambient..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            />
            <Button type="button" variant="ghost" size="sm" onClick={addGenre}>
              + Add
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={submitting || uploading || !state.title || !state.coverUrl}
          className="w-full"
        >
          {submitting ? 'Saving...' : 'Next →'}
        </Button>
      </form>
      {error && <p className="text-xs italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
