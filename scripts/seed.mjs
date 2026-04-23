#!/usr/bin/env node
// SynthCamp — seed fake artists, releases, tracks, and listening parties.
//
// Usage (from anywhere with network access to the API):
//   SUPABASE_URL=https://api.synthcamp.net \
//   SUPABASE_SERVICE_ROLE_KEY=xxx \
//   node scripts/seed.mjs
//
// Idempotent: rerun skips existing users/releases/tracks/parties by slug/email.
// Service role bypasses RLS, so everything inserts regardless of auth state.

import process from 'node:process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const AUTH = `${SUPABASE_URL}/auth/v1`;
const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

// ───────── Helpers ─────────

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

function nextSlotAlignedTo15Min(offsetDays) {
  const now = Date.now();
  const target = now + offsetDays * 24 * 60 * 60 * 1000;
  // Round UP to next 15-min boundary (900s)
  const rounded = Math.ceil(target / 900000) * 900000;
  return new Date(rounded).toISOString();
}

function priceFor(trackCount) {
  // Matches lib/pricing.ts: ceil(n × 0.60) − 0.01
  return (Math.ceil(trackCount * 0.6) - 0.01).toFixed(2);
}

function coverUrl(slug) {
  return `https://picsum.photos/seed/${slug}/800/800`;
}

function avatarUrl(slug) {
  return `https://picsum.photos/seed/${slug}-avatar/200/200`;
}

async function ok(res, context) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} → ${res.status} ${body}`);
  }
  return res;
}

// ───────── Auth admin ─────────

async function findUserByEmail(email) {
  const res = await fetch(`${AUTH}/admin/users?per_page=1000`, { headers: HEADERS });
  await ok(res, `list users`);
  const { users } = await res.json();
  return users.find((u) => u.email === email) ?? null;
}

async function createUser(email, fullName) {
  const res = await fetch(`${AUTH}/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  await ok(res, `create user ${email}`);
  return await res.json();
}

async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`  user ${email} already exists`);
    return existing.id;
  }
  const created = await createUser(email, fullName);
  console.log(`  created user ${email}`);
  return created.id;
}

// ───────── PostgREST helpers ─────────

async function patchProfile(userId, patch) {
  const res = await fetch(`${REST}/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  await ok(res, `patch profile ${userId}`);
  return (await res.json())[0];
}

async function findReleaseBySlug(slug) {
  const res = await fetch(`${REST}/releases?slug=eq.${slug}&select=id`, { headers: HEADERS });
  await ok(res, `find release ${slug}`);
  return (await res.json())[0] ?? null;
}

async function insertRelease(row) {
  const res = await fetch(`${REST}/releases`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  await ok(res, `insert release ${row.slug}`);
  return (await res.json())[0];
}

async function insertTrack(row) {
  const res = await fetch(`${REST}/tracks`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  await ok(res, `insert track ${row.title}`);
  return (await res.json())[0];
}

async function getRoomIdBySlug(slug) {
  const res = await fetch(`${REST}/rooms?slug=eq.${slug}&select=id`, { headers: HEADERS });
  await ok(res, `fetch room ${slug}`);
  const row = (await res.json())[0];
  if (!row) throw new Error(`Room ${slug} not found`);
  return row.id;
}

async function findPartyByRelease(releaseId) {
  const res = await fetch(`${REST}/listening_parties?release_id=eq.${releaseId}&select=id`, {
    headers: HEADERS,
  });
  await ok(res, `find party for ${releaseId}`);
  return (await res.json())[0] ?? null;
}

async function insertParty(row) {
  const res = await fetch(`${REST}/listening_parties`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  await ok(res, `insert party`);
  return (await res.json())[0];
}

// ───────── Seed definitions ─────────

const ARTISTS = [
  {
    email: 'seed-neon-shadow@synthcamp.net',
    display_name: 'Neon Shadow',
    slug: 'neon-shadow',
    bio: 'Hybrid electronic producer. Hardware synths meets AI-assisted mastering.',
    releases: [
      {
        title: 'Circuits Below',
        slug: 'circuits-below',
        description: 'A late-night drive through neon-lit circuits.',
        language: 'en',
        genres: ['electronic', 'synthwave'],
        credit_category: 'hybrid',
        credit_tags: ['production', 'mastering'],
        credit_narrative: 'Live on a Moog Matriarch, mastered with AI stem separation.',
        status: 'published',
        release_date_offset_days: -30,
        tracks: [
          { title: 'Ignition', duration_seconds: 220 },
          { title: 'Voltage Run', duration_seconds: 252 },
          { title: 'Circuits Below', duration_seconds: 298 },
          { title: 'Reboot Sequence', duration_seconds: 184 },
        ],
      },
      {
        title: 'Midnight Compiler',
        slug: 'midnight-compiler',
        description: 'Studio session EP, recorded in one take.',
        language: 'en',
        genres: ['electronic', 'techno'],
        credit_category: 'hybrid',
        credit_tags: ['production'],
        credit_narrative: 'One-take live studio session, no overdubs.',
        status: 'scheduled',
        release_date_offset_days: 14,
        tracks: [
          { title: 'Compile Start', duration_seconds: 195 },
          { title: 'Stack Trace', duration_seconds: 240 },
          { title: 'Midnight Compiler', duration_seconds: 310 },
        ],
        party: { room_slug: 'global-master', offset_days: 7 },
      },
    ],
  },
  {
    email: 'seed-luna-ostrakon@synthcamp.net',
    display_name: 'Luna Ostrakon',
    slug: 'luna-ostrakon',
    bio: 'Acoustic folk with field recordings. No AI, no plug-ins.',
    releases: [
      {
        title: 'Salt Meridian',
        slug: 'salt-meridian',
        description: 'Recorded on a single mic at the edge of the Atlantic.',
        language: 'en',
        genres: ['folk', 'ambient'],
        credit_category: 'acoustic',
        credit_tags: [],
        credit_narrative: 'Single-mic capture. Nylon guitar + field recordings.',
        status: 'published',
        release_date_offset_days: -60,
        tracks: [
          { title: 'Meridian Dawn', duration_seconds: 272 },
          { title: 'Tide Oath', duration_seconds: 198 },
          { title: 'Salt Bell', duration_seconds: 324 },
          { title: 'Near Shore', duration_seconds: 236 },
          { title: 'The Horizon Complains', duration_seconds: 411 },
        ],
      },
      {
        title: 'Kiln Room',
        slug: 'kiln-room',
        description: 'Chamber folk. Cello + voice.',
        language: 'en',
        genres: ['folk', 'chamber'],
        credit_category: 'acoustic',
        credit_tags: [],
        credit_narrative: 'Recorded live in a disused ceramics kiln. Natural reverb only.',
        status: 'published',
        release_date_offset_days: -10,
        tracks: [
          { title: 'Clay Warming', duration_seconds: 286 },
          { title: 'Glaze, Unfired', duration_seconds: 195 },
          { title: 'The Kiln Room', duration_seconds: 404 },
        ],
      },
    ],
  },
  {
    email: 'seed-vector-pulse@synthcamp.net',
    display_name: 'Vector Pulse',
    slug: 'vector-pulse',
    bio: 'AI-crafted IDM and techno. Every sound generated, every structure hand-curated.',
    releases: [
      {
        title: 'Topology',
        slug: 'topology',
        description: 'A mapping of density and silence, entirely generated.',
        language: 'en',
        genres: ['idm', 'techno'],
        credit_category: 'ai_crafted',
        credit_tags: ['production', 'arrangement', 'mastering'],
        credit_narrative: 'Suno v4 seeds, stems re-arranged and mastered manually.',
        status: 'published',
        release_date_offset_days: -45,
        tracks: [
          { title: 'Torus 01', duration_seconds: 232 },
          { title: 'Klein Surface', duration_seconds: 298 },
          { title: 'Möbius A', duration_seconds: 265 },
          { title: 'Topology', duration_seconds: 348 },
        ],
      },
      {
        title: 'Granular',
        slug: 'granular',
        description: 'Fragmented rhythm studies.',
        language: 'en',
        genres: ['idm', 'experimental'],
        credit_category: 'ai_crafted',
        credit_tags: ['production', 'stems'],
        credit_narrative: 'Udio stems, granularly re-sequenced in Max/MSP.',
        status: 'scheduled',
        release_date_offset_days: 21,
        tracks: [
          { title: 'Grain 1', duration_seconds: 178 },
          { title: 'Grain 2', duration_seconds: 202 },
          { title: 'Grain 3', duration_seconds: 256 },
        ],
        party: { room_slug: 'secondary-1', offset_days: 10 },
      },
    ],
  },
  {
    email: 'seed-moss-voltage@synthcamp.net',
    display_name: 'Moss & Voltage',
    slug: 'moss-voltage',
    bio: 'Indie rock duo. Analog tape, live drums, no quantization.',
    releases: [
      {
        title: 'Analog Sermon',
        slug: 'analog-sermon',
        description: 'Tape-machine rock, unvarnished.',
        language: 'en',
        genres: ['indie', 'rock'],
        credit_category: 'acoustic',
        credit_tags: [],
        credit_narrative: 'Tracked to 1/2" tape. Drums and guitars both live.',
        status: 'published',
        release_date_offset_days: -15,
        tracks: [
          { title: 'Sermon, Side A', duration_seconds: 214 },
          { title: 'Lichen', duration_seconds: 188 },
          { title: 'Voltage Drop', duration_seconds: 246 },
          { title: 'Mid-Frequency Heart', duration_seconds: 201 },
        ],
      },
      {
        title: 'Heron',
        slug: 'heron',
        description: 'Our second EP — tape-saturated post-rock.',
        language: 'en',
        genres: ['post-rock', 'indie'],
        credit_category: 'hybrid',
        credit_tags: ['mastering'],
        credit_narrative: 'Live tracking; AI-assisted de-noise on field recordings.',
        status: 'scheduled',
        release_date_offset_days: 5,
        tracks: [
          { title: 'Heron, First Light', duration_seconds: 268 },
          { title: 'Marsh', duration_seconds: 321 },
          { title: 'Heron, Leaving', duration_seconds: 192 },
        ],
        party: { room_slug: 'secondary-2', offset_days: 3 },
      },
    ],
  },
];

// ───────── Main ─────────

async function seedArtist(spec) {
  console.log(`\n→ ${spec.display_name}`);
  const userId = await ensureUser(spec.email, spec.display_name);

  await patchProfile(userId, {
    display_name: spec.display_name,
    slug: spec.slug,
    bio: spec.bio,
    avatar_url: avatarUrl(spec.slug),
    is_artist: true,
  });
  console.log(`  profile updated`);

  for (const r of spec.releases) {
    const existing = await findReleaseBySlug(r.slug);
    if (existing) {
      console.log(`  release ${r.slug} exists — skipping`);
      continue;
    }

    const totalDuration = r.tracks.reduce((sum, t) => sum + t.duration_seconds, 0);

    const release = await insertRelease({
      artist_id: userId,
      title: r.title,
      slug: r.slug,
      description: r.description,
      cover_url: coverUrl(r.slug),
      language: r.language,
      genres: r.genres,
      price_minimum: priceFor(r.tracks.length),
      credit_category: r.credit_category,
      credit_tags: r.credit_tags,
      credit_narrative: r.credit_narrative,
      status: r.status,
      release_date: daysFromNow(r.release_date_offset_days),
      is_listed: true,
    });
    console.log(`  release ${r.slug} created (${r.status})`);

    for (let i = 0; i < r.tracks.length; i++) {
      const t = r.tracks[i];
      await insertTrack({
        release_id: release.id,
        track_number: i + 1,
        title: t.title,
        duration_seconds: t.duration_seconds,
        // audio_source_key intentionally null — Phase 3 adds real audio
      });
    }
    console.log(`  ${r.tracks.length} tracks inserted`);

    if (r.party) {
      const existing = await findPartyByRelease(release.id);
      if (existing) {
        console.log(`  party already exists — skipping`);
        continue;
      }
      const roomId = await getRoomIdBySlug(r.party.room_slug);
      await insertParty({
        release_id: release.id,
        artist_id: userId,
        room_id: roomId,
        scheduled_at: nextSlotAlignedTo15Min(r.party.offset_days),
        duration_seconds: totalDuration,
      });
      console.log(`  party scheduled in ${r.party.room_slug}`);
    }
  }
}

(async () => {
  for (const a of ARTISTS) {
    await seedArtist(a);
  }
  console.log('\n✓ Seed complete');
})().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
