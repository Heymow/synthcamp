'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { Profile } from '@/lib/data/profile';

interface ProfileFormProps {
  initialProfile: Profile;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialProfile.display_name);
  const [slug, setSlug] = useState(initialProfile.slug ?? '');
  const [bio, setBio] = useState(initialProfile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus('idle');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        slug: slug || null,
        bio: bio || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string;
      };
      setError(body.error ?? 'Unknown error');
    } else {
      setStatus('saved');
      router.refresh();
    }
  };

  const becomeArtist = async () => {
    if (!slug) {
      setError('Set a slug before becoming an artist');
      return;
    }
    const res = await fetch('/api/profile/become-artist', { method: 'POST' });
    if (res.ok) {
      router.refresh();
      router.push('/artist/catalog');
    } else {
      const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string;
      };
      setError(body.error ?? 'Unknown error');
    }
  };

  return (
    <GlassPanel className="space-y-6 p-6">
      <form onSubmit={save} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Display name
          </span>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            maxLength={50}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Slug URL (e.g. neon-shadow)
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            maxLength={50}
            pattern="^[a-z0-9-]{1,50}$"
            placeholder="your-handle"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Bio (optional)
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            maxLength={1000}
            rows={4}
            placeholder="A few words about you..."
          />
        </label>

        <Button type="submit" variant="primary" size="md" disabled={saving} className="w-full">
          {saving ? 'Saving...' : status === 'saved' ? 'Saved ✓' : 'Save'}
        </Button>
      </form>

      {!initialProfile.is_artist && (
        <div className="space-y-3 border-t border-white/5 pt-5">
          <p className="text-sm text-white/80">Want to publish your music?</p>
          <Button variant="accent" size="md" onClick={becomeArtist} className="w-full">
            Become an artist
          </Button>
        </div>
      )}

      {error && <p className="text-xs italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
