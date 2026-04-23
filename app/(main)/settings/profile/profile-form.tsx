'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { compressImage } from '@/lib/image-compress';
import type { Profile } from '@/lib/data/profile';

interface ProfileFormProps {
  initialProfile: Profile;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialProfile.display_name);
  const [slug, setSlug] = useState(initialProfile.slug ?? '');
  const [bio, setBio] = useState(initialProfile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) return;

    setError(null);
    setUploading(true);
    try {
      const compressed = await compressImage(picked, {
        maxDimension: 512,
        quality: 0.85,
        skipBelowBytes: 150_000,
      });

      const urlRes = await fetch('/api/avatars/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: compressed.name }),
      });
      if (!urlRes.ok) {
        const body = (await urlRes.json().catch(() => ({ error: 'Failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Failed to get signed URL');
      }
      const { signed_url, path } = (await urlRes.json()) as {
        signed_url: string;
        path: string;
      };

      const put = await fetch(signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      });
      if (!put.ok) throw new Error('Avatar upload failed');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;

      const patchRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (!patchRes.ok) {
        const body = (await patchRes.json().catch(() => ({ error: 'Failed' }))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Failed to save avatar');
      }

      setAvatarUrl(publicUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Avatar
        </span>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 text-[9px] font-bold uppercase tracking-widest text-white/40">
              No avatar
            </div>
          )}
          <label
            className={
              'inline-flex cursor-pointer items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/20 ' +
              (uploading ? 'pointer-events-none opacity-50' : '')
            }
          >
            {uploading ? 'Uploading...' : avatarUrl ? 'Replace' : 'Choose image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        </div>
      </div>

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
