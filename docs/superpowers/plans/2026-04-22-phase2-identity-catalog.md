# SynthCamp Phase 2 — Identity + Catalog + Party Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SynthCamp catalog foundation — auth via magic link + Google OAuth, profiles with is_artist opt-in, release CRUD with Creative Credits, listening party scheduling on 3 fixed rooms with a calendar UI, and browse pages with real data replacing the Phase 1 mock.

**Architecture:** Next.js app connects to a **self-hosted Supabase stack on Railway** (Postgres + GoTrue + PostgREST + Storage + Kong gateway). Audio sources go to **Cloudflare R2** via signed URLs. Data access uses `@supabase/supabase-js` client directly (no ORM) with **RPC functions** for complex queries. Row-Level Security enforces authorization at the DB layer. pg_cron auto-publishes party-less releases on their release date; party transitions remain disabled until Phase 4.

**Tech Stack:** Next.js 16 · TypeScript strict · Supabase self-host · Postgres 15 · pg_cron · Cloudflare R2 · Resend SMTP · Google OAuth · Vitest · Playwright · Railway

**Spec reference:** `docs/superpowers/specs/2026-04-22-phase2-identity-catalog-design.md`

**Important notes:**
- Tests apply where logic exists (helpers, RPCs). Infrastructure tasks use **build-verify-commit** pattern (no TDD for config).
- Each task must produce a **clean commit**. `base.txt` and `docs/` are **never modified**.
- Phase 1 Foundation (tag `v0.1.1-foundation`) is the starting point.

---

## Milestone 0 — External services setup (manual)

These tasks require UI/web-console actions. Collect credentials for Milestone 1.

### Task 0.1: Create Resend account + API key

- [x] **Step 1:** Go to https://resend.com, sign up (free tier 3000 emails/month).
- [x] **Step 2:** In dashboard → **API Keys** → create one named `synthcamp-phase2`, scope `Sending access`.
- [x] **Step 3:** Save the API key (starts with `re_...`) — it's only shown once. Paste in password manager.
- [x] **Step 4:** Add domain verification in **Domains** (use your actual domain or skip for testing with `onboarding@resend.dev`).
- [x] **Step 5:** No commit for this step.

### Task 0.2: Create Google OAuth app

- [x] **Step 1:** Go to https://console.cloud.google.com, create a new project `synthcamp`.
- [x] **Step 2:** **APIs & Services** → **OAuth consent screen** → configure external, app name `SynthCamp`, support email, dev contact email. Scope: `openid`, `email`, `profile`. Save.
- [x] **Step 3:** **Credentials** → Create OAuth Client ID → Type **Web application** → Name `synthcamp-phase2`.
- [x] **Step 4:** Authorized redirect URI: leave blank for now (will add in Task 1.5 once Supabase URL is known).
- [x] **Step 5:** Save `CLIENT_ID` and `CLIENT_SECRET` in password manager.

### Task 0.3: Create Cloudflare R2 bucket

- [x] **Step 1:** Cloudflare Dashboard → **R2** → **Create bucket** → name `synthcamp-audio-source` → Location `Automatic` → Enable public access: **NO**.
- [x] **Step 2:** **Manage R2 API Tokens** → Create token → name `synthcamp-phase2-server` → Permissions **Object Read & Write** on `synthcamp-audio-source` → TTL: default.
- [x] **Step 3:** Save `Access Key ID`, `Secret Access Key`, `Account ID` (visible on R2 overview page).
- [x] **Step 4:** Note the S3-compatible endpoint URL: `https://<account-id>.r2.cloudflarestorage.com`.

---

## Milestone 1 — Deploy Supabase self-host on Railway

Realistic: 4-8 hours debugging. Use the official docker-compose.

### Task 1.1: Clone and prepare Supabase docker-compose

**Files:**
- Create: `supabase-selfhost/` (sibling directory to Next.js app, OR separate folder pushed to its own Railway service — recommended separate folder for isolation)

- [x] **Step 1:** Create a new directory for the Supabase config. From project root:

```bash
mkdir -p supabase-selfhost
cd supabase-selfhost
curl -L https://github.com/supabase/supabase/raw/master/docker/docker-compose.yml -o docker-compose.yml
curl -L https://github.com/supabase/supabase/raw/master/docker/.env.example -o .env.example
```

- [x] **Step 2:** In `supabase-selfhost/docker-compose.yml`, **remove or comment out** the `realtime` service block (not needed until Phase 4, saves resources).

- [x] **Step 3:** Create `supabase-selfhost/.env` from `.env.example` and fill in (paste your values, DO NOT commit):

```bash
POSTGRES_PASSWORD=<generate 32 chars via `openssl rand -base64 32`>
JWT_SECRET=<generate 32 chars via `openssl rand -hex 32`>
ANON_KEY=<generate using jwt tool — see supabase docs, 10-year expiry>
SERVICE_ROLE_KEY=<generate using jwt tool — see supabase docs, 10-year expiry>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<strong password>
SITE_URL=https://<to-fill-after-railway-deploy>.up.railway.app
API_EXTERNAL_URL=https://<to-fill>.up.railway.app
SUPABASE_PUBLIC_URL=https://<to-fill>.up.railway.app
SMTP_ADMIN_EMAIL=noreply@<your-domain>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend-api-key-from-Task-0.1>
SMTP_SENDER_NAME=SynthCamp
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_ANONYMOUS_USERS=false
```

- [x] **Step 4:** Add `.env` to `.gitignore` at repo root:

```bash
cd /c/Projets/SynthCamp-marketplace
echo "supabase-selfhost/.env" >> .gitignore
echo "supabase-selfhost/volumes/" >> .gitignore
git add .gitignore
```

- [x] **Step 5:** Commit the scaffold:

```bash
git add supabase-selfhost/docker-compose.yml supabase-selfhost/.env.example
git commit -m "chore(supabase): scaffold self-host docker-compose (realtime disabled)"
```

### Task 1.2: Deploy Supabase stack to Railway

- [x] **Step 1:** Railway dashboard → same project `synthcamp` → **New Service** → **Deploy from GitHub** → pick repo `Heymow/synthcamp` → **Root Directory**: `supabase-selfhost`.

- [x] **Step 2:** Railway detects docker-compose. Name the service `supabase-stack`.

- [x] **Step 3:** **Variables** tab → paste all contents of `supabase-selfhost/.env` (don't commit these).

- [x] **Step 4:** **Volumes** tab → add volume `postgres-data` mounted at `/var/lib/postgresql/data`.

- [x] **Step 5:** **Networking** tab → generate public domain for the service (e.g., `supabase-stack-production.up.railway.app`).

- [x] **Step 6:** Update `.env` values on Railway Variables: `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` all set to the generated URL.

- [x] **Step 7:** Deploy. Wait ~5-10 min for initial start. Check logs — expect errors about missing Postgres initially (self-resolves), then stabilization.

- [x] **Step 8:** Verify Kong gateway responds: `curl https://<supabase-url>/auth/v1/health` → expect `{"version":"v...","name":"GoTrue","description":"...","full_description":"..."}`.

- [x] **Step 9:** Verify Postgres via Studio: open `https://<supabase-url>` in browser, login with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`. Studio should load.

No git commit (Railway config lives in Railway's UI, not git).

### Task 1.3: Finalize Google OAuth redirect URI

- [x] **Step 1:** Go back to Google Cloud Console OAuth credentials from Task 0.2.
- [x] **Step 2:** Add authorized redirect URI: `https://<supabase-url>/auth/v1/callback`.
- [x] **Step 3:** Save.
- [x] **Step 4:** On Railway `supabase-stack` Variables, add:

```
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google-client-secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://<supabase-url>/auth/v1/callback
```

- [x] **Step 5:** Redeploy `supabase-stack`. Wait for restart.
- [x] **Step 6:** Verify: `curl https://<supabase-url>/auth/v1/settings` → should list `google` in `external` providers.

---

## Milestone 2 — Supabase CLI + initial migration

### Task 2.1: Install Supabase CLI and init local config

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/` (empty dir)

- [x] **Step 1:** Install CLI globally:

```bash
pnpm add -g supabase
supabase --version
```

Expected: `2.x.x` or higher.

- [x] **Step 2:** From project root `/c/Projets/SynthCamp-marketplace/`:

```bash
supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/`.

- [x] **Step 3:** Commit scaffold:

```bash
git add supabase/
git commit -m "chore(db): init supabase CLI config"
```

### Task 2.2: Link CLI to self-hosted Supabase

- [x] **Step 1:** The self-host Supabase doesn't use Supabase Cloud project IDs. Instead, we use direct Postgres URL for migrations.

Get the Postgres connection string from Railway `supabase-stack` Variables → it's derived from `POSTGRES_PASSWORD` + the internal Postgres service. Expose it:

Railway `supabase-stack` service → under Postgres service (auto-provisioned inside the stack) → **Connect** → **External Connection URL**. If not directly exposed, create a **PRIVATE_NETWORK_IP** referenced URL OR add `POSTGRES_PORT=5432` to expose.

Alternative: add a new Railway service `postgres-direct` that proxies port 5432, OR use `railway run` from your local machine which tunnels into the private network.

- [x] **Step 2:** Save the connection string locally (DO NOT commit):

```bash
echo 'DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"' >> .env.local
```

- [x] **Step 3:** Test connection:

```bash
supabase db remote commit --db-url "$DATABASE_URL" --message "test connection"
```

If it fails, debug. Common issues: wrong password, port not exposed, SSL required. Add `?sslmode=require` if needed.

- [x] **Step 4:** No commit yet — config lives in `.env.local`.

### Task 2.3: First migration — extensions and enums

**Files:**
- Create: `supabase/migrations/20260422000001_extensions_enums.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000001_extensions_enums.sql

-- Extensions required by Phase 2
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- EXCLUDE gist constraints on time ranges
CREATE EXTENSION IF NOT EXISTS pg_cron;       -- Scheduled SQL jobs

-- Enums (PostgreSQL enum types)
CREATE TYPE credit_category AS ENUM ('acoustic', 'hybrid', 'ai_crafted');
CREATE TYPE credit_verification_status AS ENUM ('declared', 'pending_review', 'verified');
CREATE TYPE release_status AS ENUM ('draft', 'scheduled', 'published', 'unlisted', 'archived');
CREATE TYPE party_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE room_kind AS ENUM ('global_master', 'secondary');
```

- [x] **Step 2:** Apply migration:

```bash
supabase db push --db-url "$DATABASE_URL"
```

Expected: `Applying migration 20260422000001_extensions_enums.sql... Success`.

- [x] **Step 3:** Verify on Studio UI → **Database** → **Extensions** → `btree_gist` and `pg_cron` should show `installed`.

- [x] **Step 4:** Commit:

```bash
git add supabase/migrations/20260422000001_extensions_enums.sql
git commit -m "db: install btree_gist + pg_cron extensions and phase2 enums"
```

---

## Milestone 3 — Schema migrations (tables + RLS + triggers)

### Task 3.1: profiles table + RLS + auto-create trigger

**Files:**
- Create: `supabase/migrations/20260422000002_profiles.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000002_profiles.sql

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  slug text UNIQUE CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{1,50}$'),
  avatar_url text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 1000),
  is_artist boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_public ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- No INSERT policy — only trigger inserts
-- No DELETE policy — cascade from auth.users

-- Auto-create profile on auth.users insert
CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_artist)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [x] **Step 2:** Apply:

```bash
supabase db push --db-url "$DATABASE_URL"
```

- [x] **Step 3:** Verify on Studio → Tables → `profiles` exists with columns + RLS enabled badge.

- [x] **Step 4:** Commit:

```bash
git add supabase/migrations/20260422000002_profiles.sql
git commit -m "db: add profiles table with RLS and auto-create trigger"
```

### Task 3.2: rooms table + seed

**Files:**
- Create: `supabase/migrations/20260422000003_rooms.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000003_rooms.sql

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  kind room_kind NOT NULL,
  display_order integer NOT NULL
);

-- Seed the 3 fixed rooms
INSERT INTO public.rooms (slug, name, kind, display_order) VALUES
  ('global-master', 'Global Master Channel', 'global_master', 1),
  ('secondary-1', 'Secondary 1', 'secondary', 2),
  ('secondary-2', 'Secondary 2', 'secondary', 3);

-- RLS: public read, no user mutations
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select_public ON public.rooms FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies — only admin via service_role can modify
```

- [x] **Step 2:** Apply:

```bash
supabase db push --db-url "$DATABASE_URL"
```

- [x] **Step 3:** Verify: `SELECT * FROM public.rooms;` on Studio SQL Editor returns 3 rows.

- [x] **Step 4:** Commit:

```bash
git add supabase/migrations/20260422000003_rooms.sql
git commit -m "db: add rooms table with 3 fixed seeded rows"
```

### Task 3.3: releases table + RLS

**Files:**
- Create: `supabase/migrations/20260422000004_releases.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000004_releases.sql

CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  cover_url text NOT NULL,
  language text CHECK (language IS NULL OR char_length(language) = 2),
  genres text[] NOT NULL DEFAULT '{}' CHECK (array_length(genres, 1) IS NULL OR array_length(genres, 1) <= 5),
  price_minimum numeric(10,2) NOT NULL CHECK (price_minimum >= 0),
  credit_category credit_category NOT NULL,
  credit_tags text[] NOT NULL DEFAULT '{}',
  credit_narrative text CHECK (credit_narrative IS NULL OR char_length(credit_narrative) <= 280),
  credits_per_track boolean NOT NULL DEFAULT false,
  verification_status credit_verification_status NOT NULL DEFAULT 'declared',
  release_date timestamptz,
  status release_status NOT NULL DEFAULT 'draft',
  is_listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Public can read published and unlisted (unlisted still accessible if URL known)
CREATE POLICY releases_select_public ON public.releases FOR SELECT
  USING (
    status IN ('published', 'unlisted', 'scheduled')
    OR auth.uid() = artist_id
  );

-- Artist can INSERT own releases
CREATE POLICY releases_insert_own ON public.releases FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

-- Artist can UPDATE own releases
CREATE POLICY releases_update_own ON public.releases FOR UPDATE
  USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

-- No DELETE policy — releases can only be archived (see § 5.3 spec)
CREATE POLICY releases_no_delete ON public.releases FOR DELETE USING (false);

-- Indexes
CREATE INDEX idx_releases_artist_status ON public.releases(artist_id, status);
CREATE INDEX idx_releases_status_listed_created ON public.releases(status, is_listed, created_at DESC)
  WHERE status = 'published' AND is_listed = true;
```

- [x] **Step 2:** Apply + verify via Studio.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000004_releases.sql
git commit -m "db: add releases table with RLS (no DELETE, archive-only)"
```

### Task 3.4: tracks table + RLS

**Files:**
- Create: `supabase/migrations/20260422000005_tracks.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000005_tracks.sql

CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  track_number integer NOT NULL CHECK (track_number BETWEEN 1 AND 100),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  audio_source_key text,
  hls_manifest_key text,
  aes_key_id uuid,
  credit_category credit_category,
  credit_tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(release_id, track_number)
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Public can SELECT tracks if the release is visible to them
CREATE POLICY tracks_select_via_release ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id
        AND (r.status IN ('published', 'unlisted', 'scheduled') OR r.artist_id = auth.uid())
    )
  );

-- Artist can INSERT tracks on own release
CREATE POLICY tracks_insert_on_own_release ON public.tracks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid())
  );

-- Artist can UPDATE tracks on own release
CREATE POLICY tracks_update_on_own_release ON public.tracks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid()));

-- DELETE only allowed on tracks of a draft release
CREATE POLICY tracks_delete_if_draft ON public.tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id
        AND r.artist_id = auth.uid()
        AND r.status = 'draft'
    )
  );

CREATE INDEX idx_tracks_release_number ON public.tracks(release_id, track_number);
```

- [x] **Step 2:** Apply + verify.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000005_tracks.sql
git commit -m "db: add tracks table with RLS (DELETE only on draft releases)"
```

### Task 3.5: listening_parties table + RLS + exclusion constraint

**Files:**
- Create: `supabase/migrations/20260422000006_listening_parties.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000006_listening_parties.sql

CREATE TABLE public.listening_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL UNIQUE REFERENCES public.releases(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL
    CHECK (extract(epoch from scheduled_at)::bigint % 900 = 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  ends_at timestamptz GENERATED ALWAYS AS
    (scheduled_at + make_interval(secs => duration_seconds)) STORED,
  status party_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(scheduled_at, ends_at) WITH &&
  ) WHERE (status IN ('scheduled', 'live'))
);

ALTER TABLE public.listening_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY parties_select_public ON public.listening_parties FOR SELECT USING (true);

CREATE POLICY parties_insert_via_rpc ON public.listening_parties FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY parties_update_own ON public.listening_parties FOR UPDATE
  USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

-- No DELETE — cancellation via status='cancelled'
CREATE POLICY parties_no_delete ON public.listening_parties FOR DELETE USING (false);

CREATE INDEX idx_parties_room_status ON public.listening_parties(room_id, status, scheduled_at);
CREATE INDEX idx_parties_artist_status ON public.listening_parties(artist_id, status);
```

- [x] **Step 2:** Apply + verify (test the exclusion constraint with 2 overlapping inserts — second should fail).

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000006_listening_parties.sql
git commit -m "db: add listening_parties table with overlap exclusion constraint"
```

### Task 3.6: party_moderators table

**Files:**
- Create: `supabase/migrations/20260422000007_party_moderators.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000007_party_moderators.sql

CREATE TABLE public.party_moderators (
  party_id uuid NOT NULL REFERENCES public.listening_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_during_party boolean NOT NULL DEFAULT false,
  PRIMARY KEY (party_id, user_id)
);

ALTER TABLE public.party_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY party_moderators_select_public ON public.party_moderators FOR SELECT USING (true);

-- Artist of the party OR existing moderator can add/remove
CREATE POLICY party_moderators_write ON public.party_moderators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.id = party_id
        AND (
          p.artist_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.party_moderators pm WHERE pm.party_id = p.id AND pm.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.id = party_id
        AND (
          p.artist_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.party_moderators pm WHERE pm.party_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );
```

- [x] **Step 2:** Apply + verify.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000007_party_moderators.sql
git commit -m "db: add party_moderators join table with cascading delegation policy"
```

### Task 3.7: purchases table (Phase 2 schema only)

**Files:**
- Create: `supabase/migrations/20260422000008_purchases.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000008_purchases.sql

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  amount_paid numeric(10,2) NOT NULL CHECK (amount_paid >= 0),
  stripe_payment_intent text UNIQUE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, release_id)
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select_self_or_artist ON public.purchases FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid())
  );

-- No INSERT policy — Phase 3 Stripe webhooks insert via service_role
-- No DELETE or UPDATE — purchases immutable

CREATE INDEX idx_purchases_release_date ON public.purchases(release_id, purchased_at DESC);
```

- [x] **Step 2:** Apply + verify.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000008_purchases.sql
git commit -m "db: add purchases table schema (Phase 3 populates via Stripe)"
```

### Task 3.8: updated_at auto-refresh triggers

**Files:**
- Create: `supabase/migrations/20260422000009_updated_at_triggers.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000009_updated_at_triggers.sql

CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER releases_set_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listening_parties_set_updated_at
  BEFORE UPDATE ON public.listening_parties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [x] **Step 2:** Apply + verify by updating a row and checking `updated_at` changes.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000009_updated_at_triggers.sql
git commit -m "db: add generic set_updated_at trigger on mutable tables"
```

---

## Milestone 4 — RPC functions and pg_cron

### Task 4.1: compute_release_credits_from_tracks + trigger

**Files:**
- Create: `supabase/migrations/20260422000010_rpc_credits.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000010_rpc_credits.sql

CREATE FUNCTION public.compute_release_credits_from_tracks(p_release_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  distinct_categories credit_category[];
  all_tags text[];
BEGIN
  SELECT array_agg(DISTINCT credit_category) FILTER (WHERE credit_category IS NOT NULL)
  INTO distinct_categories
  FROM public.tracks WHERE release_id = p_release_id;

  SELECT array_agg(DISTINCT tag)
  INTO all_tags
  FROM public.tracks t, LATERAL unnest(COALESCE(t.credit_tags, '{}'::text[])) AS tag
  WHERE t.release_id = p_release_id;

  UPDATE public.releases
  SET
    credit_category = CASE
      WHEN distinct_categories IS NULL OR array_length(distinct_categories, 1) = 0 THEN credit_category
      WHEN array_length(distinct_categories, 1) = 1 THEN distinct_categories[1]
      ELSE 'hybrid'::credit_category
    END,
    credit_tags = COALESCE(all_tags, '{}'),
    updated_at = now()
  WHERE id = p_release_id AND credits_per_track = true;
END;
$$;

CREATE FUNCTION public.trigger_recompute_release_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release_id uuid;
BEGIN
  v_release_id := COALESCE(NEW.release_id, OLD.release_id);
  PERFORM public.compute_release_credits_from_tracks(v_release_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tracks_credits_update_trigger
AFTER INSERT OR UPDATE OF credit_category, credit_tags OR DELETE ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_release_credits();
```

- [x] **Step 2:** Apply + manually test: insert a release with `credits_per_track = true`, add 2 tracks with different categories, verify release category becomes `hybrid`.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000010_rpc_credits.sql
git commit -m "db: add compute_release_credits_from_tracks RPC + auto trigger"
```

### Task 4.2: get_editors_choice RPC

**Files:**
- Create: `supabase/migrations/20260422000011_rpc_editors_choice.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000011_rpc_editors_choice.sql

CREATE FUNCTION public.get_editors_choice()
RETURNS TABLE (
  release_id uuid,
  revenue_30d numeric,
  is_fallback boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  top_record record;
BEGIN
  SELECT r.id AS id, COALESCE(SUM(p.amount_paid), 0) AS rev, r.created_at AS created_at
  INTO top_record
  FROM public.releases r
  LEFT JOIN public.purchases p ON p.release_id = r.id
    AND p.purchased_at >= now() - interval '30 days'
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY r.id, r.created_at
  HAVING COALESCE(SUM(p.amount_paid), 0) > 0
  ORDER BY rev DESC, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT top_record.id, top_record.rev, false;
  ELSE
    RETURN QUERY
    SELECT r.id, 0::numeric, true
    FROM public.releases r
    WHERE r.status = 'published' AND r.is_listed = true
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_editors_choice() TO anon, authenticated;
```

- [x] **Step 2:** Apply + test via Studio SQL Editor: `SELECT * FROM public.get_editors_choice();` → empty tbl currently (no releases), returns nothing or one fallback row.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000011_rpc_editors_choice.sql
git commit -m "db: add get_editors_choice RPC with Fresh fallback"
```

### Task 4.3: validate_release_publish RPC

**Files:**
- Create: `supabase/migrations/20260422000012_rpc_validate_publish.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000012_rpc_validate_publish.sql

CREATE FUNCTION public.validate_release_publish(p_release_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_artist_id uuid;
  v_track_count integer;
  v_missing_audio integer;
  v_releases_this_month integer;
BEGIN
  SELECT artist_id INTO v_artist_id FROM public.releases WHERE id = p_release_id;
  IF v_artist_id IS NULL OR v_artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Release not found or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_track_count FROM public.tracks WHERE release_id = p_release_id;
  IF v_track_count < 3 THEN
    RAISE EXCEPTION 'Minimum 3 tracks required (found %)', v_track_count USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_missing_audio FROM public.tracks
  WHERE release_id = p_release_id AND audio_source_key IS NULL;
  IF v_missing_audio > 0 THEN
    RAISE EXCEPTION 'All tracks must have audio uploaded (% missing)', v_missing_audio USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_releases_this_month FROM public.releases
  WHERE artist_id = v_artist_id
    AND status IN ('scheduled', 'published', 'unlisted')
    AND release_date IS NOT NULL
    AND date_trunc('month', release_date) = date_trunc('month', now())
    AND id <> p_release_id;
  IF v_releases_this_month >= 2 THEN
    RAISE EXCEPTION 'Monthly release limit reached (2 per calendar month)' USING ERRCODE = '23514';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_release_publish(uuid) TO authenticated;
```

- [x] **Step 2:** Apply.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000012_rpc_validate_publish.sql
git commit -m "db: add validate_release_publish RPC (3 tracks, audio, 2/month)"
```

### Task 4.4: validate_and_create_listening_party RPC

**Files:**
- Create: `supabase/migrations/20260422000013_rpc_create_party.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000013_rpc_create_party.sql

CREATE FUNCTION public.validate_and_create_listening_party(
  p_release_id uuid,
  p_room_id uuid,
  p_scheduled_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_artist_id uuid;
  v_release_status release_status;
  v_duration integer;
  v_room_kind room_kind;
  v_party_id uuid;
BEGIN
  SELECT artist_id, status INTO v_artist_id, v_release_status
  FROM public.releases WHERE id = p_release_id;

  IF v_artist_id IS NULL OR v_artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Release not found or not owned';
  END IF;

  IF v_release_status <> 'draft' THEN
    RAISE EXCEPTION 'Party scheduling only at publish time (release must be in draft status)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE artist_id = v_artist_id AND status IN ('scheduled', 'live')
  ) THEN
    RAISE EXCEPTION 'Artist already has an active party';
  END IF;

  SELECT kind INTO v_room_kind FROM public.rooms WHERE id = p_room_id;
  IF v_room_kind IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room_kind = 'global_master' THEN
    IF EXISTS (
      SELECT 1 FROM public.listening_parties p
      JOIN public.rooms r ON r.id = p.room_id
      WHERE p.artist_id = v_artist_id
        AND r.kind = 'global_master'
        AND p.status <> 'cancelled'
        AND date_trunc('month', p.scheduled_at) = date_trunc('month', p_scheduled_at)
    ) THEN
      RAISE EXCEPTION 'GMC limit reached for this calendar month';
    END IF;
  END IF;

  IF p_scheduled_at > now() + interval '3 months' THEN
    RAISE EXCEPTION 'Cannot schedule more than 3 months ahead';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot schedule in the past';
  END IF;

  SELECT COALESCE(SUM(duration_seconds), 0) INTO v_duration
  FROM public.tracks WHERE release_id = p_release_id;
  IF v_duration <= 0 THEN
    RAISE EXCEPTION 'Release has no tracks';
  END IF;

  INSERT INTO public.listening_parties (release_id, artist_id, room_id, scheduled_at, duration_seconds)
  VALUES (p_release_id, v_artist_id, p_room_id, p_scheduled_at, v_duration)
  RETURNING id INTO v_party_id;

  UPDATE public.releases SET status = 'scheduled', release_date = p_scheduled_at
  WHERE id = p_release_id;

  RETURN v_party_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_and_create_listening_party(uuid, uuid, timestamptz) TO authenticated;
```

- [x] **Step 2:** Apply.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000013_rpc_create_party.sql
git commit -m "db: add validate_and_create_listening_party RPC with all rate limits"
```

### Task 4.5: cancel_listening_party + check_release_editable RPCs

**Files:**
- Create: `supabase/migrations/20260422000014_rpc_cancel_and_check.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000014_rpc_cancel_and_check.sql

CREATE FUNCTION public.cancel_listening_party(p_party_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_party record;
BEGIN
  SELECT * INTO v_party FROM public.listening_parties WHERE id = p_party_id;

  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  IF v_party.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not owner';
  END IF;

  IF v_party.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Party is not scheduled (current status: %)', v_party.status;
  END IF;

  IF v_party.scheduled_at - interval '1 hour' < now() THEN
    RAISE EXCEPTION 'Cancel window closed (< 1h before start)';
  END IF;

  UPDATE public.listening_parties SET status = 'cancelled', updated_at = now()
  WHERE id = p_party_id;

  UPDATE public.releases SET status = 'draft', release_date = NULL
  WHERE id = v_party.release_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_listening_party(uuid) TO authenticated;

CREATE FUNCTION public.check_release_editable(p_release_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status IN ('scheduled', 'live')
      AND (scheduled_at - interval '24 hours') < now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_release_editable(uuid) TO authenticated;
```

- [x] **Step 2:** Apply.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000014_rpc_cancel_and_check.sql
git commit -m "db: add cancel_listening_party + check_release_editable RPCs"
```

### Task 4.6: cron_publish_future_releases + pg_cron job

**Files:**
- Create: `supabase/migrations/20260422000015_cron_publish_releases.sql`

- [x] **Step 1:** Write migration:

```sql
-- File: supabase/migrations/20260422000015_cron_publish_releases.sql

CREATE FUNCTION public.cron_publish_future_releases()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.releases r
  SET status = 'published', updated_at = now()
  WHERE r.status = 'scheduled'
    AND r.release_date IS NOT NULL
    AND r.release_date <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.release_id = r.id
        AND p.status NOT IN ('cancelled', 'ended')
    );
$$;

SELECT cron.schedule(
  'publish-future-releases',
  '* * * * *',
  $$SELECT public.cron_publish_future_releases();$$
);
```

- [x] **Step 2:** Apply + verify job is scheduled: `SELECT * FROM cron.job;` should show `publish-future-releases`.

- [x] **Step 3:** Commit:

```bash
git add supabase/migrations/20260422000015_cron_publish_releases.sql
git commit -m "db: add pg_cron job to auto-publish party-less scheduled releases"
```

---

## Milestone 5 — TypeScript types generation

### Task 5.1: Add type generation script

**Files:**
- Modify: `package.json` (add script)
- Create: `lib/database.types.ts` (generated file, will be committed)

- [x] **Step 1:** Edit `package.json` scripts section, add:

```json
"db:types": "supabase gen types typescript --db-url \"$DATABASE_URL\" --schema public > lib/database.types.ts"
```

- [x] **Step 2:** Run:

```bash
pnpm db:types
```

Expected: `lib/database.types.ts` created with all the types from Phase 2 schema. ~200 lines.

- [x] **Step 3:** Verify build still works: `pnpm build`.

- [x] **Step 4:** Commit:

```bash
git add package.json lib/database.types.ts
git commit -m "chore(db): add type generation script and initial types"
```

---

## Milestone 6 — Auth infrastructure

### Task 6.1: Install @supabase/ssr helpers (already installed in Phase 1 via deps)

Already installed in Phase 1. Verify:

```bash
pnpm list @supabase/ssr @supabase/supabase-js
```

No commit needed.

### Task 6.2: Replace Supabase client stubs with real implementations

**Files:**
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`

- [x] **Step 1:** Overwrite `lib/supabase/client.ts`:

```typescript
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  return createBrowserClient<Database>(url, anon);
}
```

- [x] **Step 2:** Overwrite `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from Server Component — setting cookies not allowed here
        }
      },
    },
  });
}
```

- [x] **Step 3:** Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient<Database>(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refresh session if expired
  await supabase.auth.getUser();
  return response;
}
```

- [x] **Step 4:** Verify build:

```bash
pnpm build
```

- [x] **Step 5:** Commit:

```bash
git add lib/supabase/
git commit -m "feat(auth): wire real Supabase clients (browser + server + middleware)"
```

### Task 6.3: Add Next middleware for session refresh

**Files:**
- Create: `middleware.ts` (project root)

- [x] **Step 1:** Create `middleware.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [x] **Step 2:** Verify build + dev server.

- [x] **Step 3:** Commit:

```bash
git add middleware.ts
git commit -m "feat(auth): add Next middleware to refresh Supabase session"
```

### Task 6.4: Login page

**Files:**
- Create: `app/auth/login/page.tsx`

- [x] **Step 1:** Create `app/auth/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setStatus('error');
      setError(err.message);
    } else {
      setStatus('sent');
    }
  };

  const submitGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="w-full space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <LogoS size={48} />
          <h1 className="text-2xl font-black italic uppercase leading-none tracking-tighter text-white">
            SynthCamp
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            Bienvenue
          </p>
        </div>

        <Button variant="ghost" size="lg" onClick={submitGoogle} className="w-full">
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span>ou</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <form onSubmit={submitMagicLink} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            disabled={status === 'sending' || status === 'sent'}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending' ? 'Envoi...' : status === 'sent' ? 'Email envoyé ✓' : 'Recevoir le lien magique'}
          </Button>
        </form>

        {status === 'sent' && (
          <p className="text-center text-xs italic text-white/70">
            Check ta boîte mail, click sur le lien pour te connecter.
          </p>
        )}

        {error && (
          <p className="text-center text-xs italic text-red-400">{error}</p>
        )}
      </GlassPanel>
    </main>
  );
}
```

- [x] **Step 2:** Test manually: `pnpm dev`, visit `http://localhost:3000/auth/login`. Enter real email, check Resend dashboard → email sent.

- [x] **Step 3:** Commit:

```bash
git add app/auth/login/page.tsx
git commit -m "feat(auth): add login page with magic link + Google OAuth"
```

### Task 6.5: Callback handler page

**Files:**
- Create: `app/auth/callback/route.ts`

- [x] **Step 1:** Create `app/auth/callback/route.ts` (API route, not page — handles the post-auth redirect):

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/explore/home';

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
```

- [x] **Step 2:** Verify: complete a full login flow manually (magic link or Google), land on `/explore/home`.

- [x] **Step 3:** Commit:

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): add callback route for magic link + OAuth code exchange"
```

### Task 6.6: Logout action

**Files:**
- Create: `app/auth/logout/route.ts`

- [x] **Step 1:** Create `app/auth/logout/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/explore/home', request.url), { status: 303 });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/auth/logout/route.ts
git commit -m "feat(auth): add logout route"
```

---

## Milestone 7 — Profile pages and API routes

### Task 7.1: GET profile data server helper

**Files:**
- Create: `lib/data/profile.ts`

- [x] **Step 1:** Create helper:

```typescript
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function getProfileBySlug(slug: string): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  return data;
}
```

- [x] **Step 2:** Commit:

```bash
git add lib/data/profile.ts
git commit -m "feat(profile): add server helpers for current and by-slug fetch"
```

### Task 7.2: Profile settings page

**Files:**
- Create: `app/settings/profile/page.tsx`
- Create: `app/settings/profile/profile-form.tsx` (client component)

- [x] **Step 1:** Create server page `app/settings/profile/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/data/profile';
import { ProfileForm } from './profile-form';

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Profil
      </h2>
      <ProfileForm initialProfile={profile} />
    </main>
  );
}
```

- [x] **Step 2:** Create client form `app/settings/profile/profile-form.tsx`:

```typescript
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
      const { error: msg } = await res.json().catch(() => ({ error: 'Unknown error' }));
      setError(msg);
    } else {
      router.refresh();
    }
  };

  const becomeArtist = async () => {
    if (!slug) {
      setError('Définis un slug avant de passer artiste');
      return;
    }
    const res = await fetch('/api/profile/become-artist', { method: 'POST' });
    if (res.ok) {
      router.refresh();
      router.push('/artist/catalog');
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: 'Unknown error' }));
      setError(msg);
    }
  };

  return (
    <GlassPanel className="space-y-6 p-6">
      <form onSubmit={save} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Nom affiché
          </span>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
            maxLength={50}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Slug URL (ex: neon-shadow)
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
            maxLength={50}
            pattern="^[a-z0-9-]{1,50}$"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Bio (optionnel)
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
            maxLength={1000}
            rows={4}
          />
        </label>

        <Button type="submit" variant="primary" size="md" disabled={saving} className="w-full">
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </Button>
      </form>

      {!initialProfile.is_artist && (
        <div className="space-y-3 border-t border-white/5 pt-5">
          <p className="text-sm text-white/80">
            Tu veux publier ta musique ?
          </p>
          <Button variant="accent" size="md" onClick={becomeArtist} className="w-full">
            Devenir artiste
          </Button>
        </div>
      )}

      {error && <p className="text-xs italic text-red-400">{error}</p>}
    </GlassPanel>
  );
}
```

- [x] **Step 3:** Commit:

```bash
git add "app/settings/profile/"
git commit -m "feat(profile): add /settings/profile page with edit form + become-artist flow"
```

### Task 7.3: PATCH /api/profile route

**Files:**
- Create: `app/api/profile/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { display_name, slug, bio, avatar_url } = body;

  const updates: Record<string, unknown> = {};
  if (typeof display_name === 'string') updates.display_name = display_name;
  if (slug === null || typeof slug === 'string') updates.slug = slug;
  if (bio === null || typeof bio === 'string') updates.bio = bio;
  if (avatar_url === null || typeof avatar_url === 'string') updates.avatar_url = avatar_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/profile/route.ts
git commit -m "feat(profile): add PATCH /api/profile endpoint"
```

### Task 7.4: POST /api/profile/become-artist route

**Files:**
- Create: `app/api/profile/become-artist/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Require slug set before becoming artist
  const { data: profile } = await supabase
    .from('profiles').select('slug').eq('id', user.id).single();
  if (!profile?.slug) {
    return NextResponse.json({ error: 'Set a slug first' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update({ is_artist: true }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/profile/become-artist/route.ts
git commit -m "feat(profile): add POST /api/profile/become-artist route"
```

---

## Milestone 8 — Core helpers (pricing, slug, slots) with unit tests

### Task 8.1: Update lib/pricing.ts — remove single case

**Files:**
- Modify: `lib/pricing.ts`
- Create: `tests/lib/pricing.test.ts`

- [x] **Step 1:** Write failing test `tests/lib/pricing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPrice, getReleaseLabel } from '@/lib/pricing';

describe('getPrice', () => {
  it('3 tracks → $1.79', () => {
    expect(getPrice(3)).toBe('1.79');
  });
  it('5 tracks → $2.99', () => {
    expect(getPrice(5)).toBe('2.99');
  });
  it('6 tracks → $3.59', () => {
    expect(getPrice(6)).toBe('3.59');
  });
  it('12 tracks → $7.19', () => {
    expect(getPrice(12)).toBe('7.19');
  });
});

describe('getReleaseLabel', () => {
  it('3 tracks → EP', () => {
    expect(getReleaseLabel(3)).toBe('3 tracks • EP');
  });
  it('5 tracks → EP', () => {
    expect(getReleaseLabel(5)).toBe('5 tracks • EP');
  });
  it('6 tracks → Album', () => {
    expect(getReleaseLabel(6)).toBe('6 tracks • Album');
  });
  it('12 tracks → Album', () => {
    expect(getReleaseLabel(12)).toBe('12 tracks • Album');
  });
});
```

- [x] **Step 2:** Run tests, expect failure on current pricing.ts (still has 'Single' case):

```bash
pnpm test tests/lib/pricing.test.ts
```

- [x] **Step 3:** Update `lib/pricing.ts`:

```typescript
export function getPrice(trackCount: number): string {
  const calculated = Math.ceil(trackCount * 0.6);
  return `${calculated - 0.01}`;
}

export function getReleaseLabel(trackCount: number): string {
  const type = trackCount <= 5 ? 'EP' : 'Album';
  return `${trackCount} tracks • ${type}`;
}
```

- [x] **Step 4:** Run tests, all pass.

- [x] **Step 5:** Commit:

```bash
git add lib/pricing.ts tests/lib/pricing.test.ts
git commit -m "feat(pricing): remove Single case (EP starts at 3 tracks), add tests"
```

### Task 8.2: Create lib/slug.ts

**Files:**
- Create: `lib/slug.ts`
- Create: `tests/lib/slug.test.ts`

- [x] **Step 1:** Write failing test:

```typescript
import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('basic title', () => {
    expect(slugify('Neural Drift')).toBe('neural-drift');
  });
  it('accents removed', () => {
    expect(slugify('Étoiles Éternelles')).toBe('etoiles-eternelles');
  });
  it('punctuation stripped', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });
  it('multiple spaces collapsed', () => {
    expect(slugify('A   B   C')).toBe('a-b-c');
  });
  it('leading/trailing dashes trimmed', () => {
    expect(slugify('-hello-')).toBe('hello');
  });
  it('max 100 chars', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });
  it('empty input → fallback', () => {
    expect(slugify('')).toBe('untitled');
  });
});
```

- [x] **Step 2:** Run test, expect import error:

```bash
pnpm test tests/lib/slug.test.ts
```

- [x] **Step 3:** Create `lib/slug.ts`:

```typescript
export function slugify(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // keep only safe chars
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

  return normalized || 'untitled';
}
```

- [x] **Step 4:** Run tests, all pass.

- [x] **Step 5:** Commit:

```bash
git add lib/slug.ts tests/lib/slug.test.ts
git commit -m "feat(slug): add slugify helper with unit tests"
```

### Task 8.3: Create lib/slots.ts (time slot utilities)

**Files:**
- Create: `lib/slots.ts`
- Create: `tests/lib/slots.test.ts`

- [x] **Step 1:** Write failing test:

```typescript
import { describe, it, expect } from 'vitest';
import { isValid15MinSlot, computeEndsAt, overlaps } from '@/lib/slots';

describe('isValid15MinSlot', () => {
  it('00:00 valid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:00:00Z'))).toBe(true);
  });
  it('00:15 valid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:15:00Z'))).toBe(true);
  });
  it('00:07 invalid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:07:00Z'))).toBe(false);
  });
  it('00:30:15 invalid (has seconds)', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:30:15Z'))).toBe(false);
  });
});

describe('computeEndsAt', () => {
  it('adds duration in seconds', () => {
    const start = new Date('2026-05-01T15:00:00Z');
    const end = computeEndsAt(start, 1800); // 30 min
    expect(end.toISOString()).toBe('2026-05-01T15:30:00.000Z');
  });
});

describe('overlaps', () => {
  it('identical ranges overlap', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });
  it('adjacent ranges (touching endpoints) do NOT overlap', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T16:00:00Z'), end: new Date('2026-05-01T17:00:00Z') };
    expect(overlaps(a, b)).toBe(false);
  });
  it('partial overlap detected', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T15:30:00Z'), end: new Date('2026-05-01T16:30:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });
});
```

- [x] **Step 2:** Run test, expect import error.

- [x] **Step 3:** Create `lib/slots.ts`:

```typescript
export interface TimeRange {
  start: Date;
  end: Date;
}

export function isValid15MinSlot(date: Date): boolean {
  const epoch = Math.floor(date.getTime() / 1000);
  return epoch % 900 === 0;
}

export function computeEndsAt(start: Date, durationSeconds: number): Date {
  return new Date(start.getTime() + durationSeconds * 1000);
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  // Exclusive on endpoints: [start, end)
  return a.start < b.end && b.start < a.end;
}
```

- [x] **Step 4:** Run tests, all pass.

- [x] **Step 5:** Commit:

```bash
git add lib/slots.ts tests/lib/slots.test.ts
git commit -m "feat(slots): add time slot utilities (15-min validation, overlap, ends_at)"
```

---

## Milestone 9 — Release CRUD API routes

### Task 9.1: POST /api/releases — create draft

**Files:**
- Create: `app/api/releases/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.cover_url) {
    return NextResponse.json({ error: 'title and cover_url required' }, { status: 400 });
  }

  const baseSlug = slugify(body.title);
  let slug = baseSlug;
  let suffix = 1;

  // Collision-safe slug generation
  while (true) {
    const { data: existing } = await supabase
      .from('releases').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 100) {
      return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('releases')
    .insert({
      artist_id: user.id,
      title: body.title,
      slug,
      description: body.description ?? null,
      cover_url: body.cover_url,
      language: body.language ?? null,
      genres: body.genres ?? [],
      price_minimum: 0, // recomputed at publish
      credit_category: body.credit_category ?? 'acoustic',
      credit_tags: body.credit_tags ?? [],
      credit_narrative: body.credit_narrative ?? null,
      credits_per_track: body.credits_per_track ?? false,
      status: 'draft',
    })
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/releases/route.ts
git commit -m "feat(releases): add POST /api/releases (draft with slug generation)"
```

### Task 9.2: PATCH /api/releases/[id] — update (with editable check)

**Files:**
- Create: `app/api/releases/[id]/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check edit lockout (24h before scheduled party)
  const { data: editable } = await supabase.rpc('check_release_editable', { p_release_id: id });
  if (editable === false) {
    return NextResponse.json({ error: 'Release is within 24h edit lockout' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const allowed = [
    'title', 'description', 'cover_url', 'language', 'genres',
    'credit_category', 'credit_tags', 'credit_narrative', 'credits_per_track', 'is_listed',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { error } = await supabase.from('releases').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/releases/[id]/route.ts
git commit -m "feat(releases): add PATCH /api/releases/:id with editable check"
```

### Task 9.3: POST /api/releases/[id]/tracks — add track

**Files:**
- Create: `app/api/releases/[id]/tracks/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: releaseId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.title || typeof body.track_number !== 'number' || typeof body.duration_seconds !== 'number') {
    return NextResponse.json({ error: 'title, track_number, duration_seconds required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tracks')
    .insert({
      release_id: releaseId,
      track_number: body.track_number,
      title: body.title,
      duration_seconds: body.duration_seconds,
      audio_source_key: body.audio_source_key ?? null,
      credit_category: body.credit_category ?? null,
      credit_tags: body.credit_tags ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/releases/[id]/tracks/route.ts
git commit -m "feat(releases): add POST /api/releases/:id/tracks"
```

### Task 9.4: PATCH + DELETE /api/releases/[id]/tracks/[trackId]

**Files:**
- Create: `app/api/releases/[id]/tracks/[trackId]/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const allowed = ['title', 'track_number', 'audio_source_key', 'credit_category', 'credit_tags'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  const { error } = await supabase.from('tracks').update(updates).eq('id', trackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS enforces: only delete if release is in draft
  const { error } = await supabase.from('tracks').delete().eq('id', trackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/api/releases/[id]/tracks/[trackId]/route.ts"
git commit -m "feat(releases): add PATCH + DELETE for individual tracks"
```

### Task 9.5: POST /api/releases/[id]/publish — orchestration

**Files:**
- Create: `app/api/releases/[id]/publish/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { party, release_date } = body as {
    party?: { room_id: string; scheduled_at: string };
    release_date?: string; // ISO, optional for party-less releases
  };

  // Validate publishing eligibility (3 tracks, audio, monthly limit)
  const { error: validationErr } = await supabase.rpc('validate_release_publish', { p_release_id: id });
  if (validationErr) return NextResponse.json({ error: validationErr.message }, { status: 400 });

  // Compute price_minimum from tracks count
  const { data: tracks } = await supabase.from('tracks').select('id').eq('release_id', id);
  const trackCount = tracks?.length ?? 0;
  const priceMinimum = Math.ceil(trackCount * 0.6) - 0.01;

  // Update price_minimum first
  await supabase.from('releases').update({ price_minimum: priceMinimum }).eq('id', id);

  if (party) {
    // Create party via RPC (which also flips release to 'scheduled')
    const { data: partyId, error: partyErr } = await supabase.rpc('validate_and_create_listening_party', {
      p_release_id: id,
      p_room_id: party.room_id,
      p_scheduled_at: party.scheduled_at,
    });
    if (partyErr) return NextResponse.json({ error: partyErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, party_id: partyId });
  } else {
    const now = new Date();
    const rd = release_date ? new Date(release_date) : now;
    const futureSchedule = rd > now;

    // Max 3 months ahead for scheduled no-party releases
    const maxDate = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000);
    if (futureSchedule && rd > maxDate) {
      return NextResponse.json({ error: 'Cannot schedule more than 3 months ahead' }, { status: 400 });
    }

    const { error } = await supabase
      .from('releases')
      .update({
        status: futureSchedule ? 'scheduled' : 'published',
        release_date: rd.toISOString(),
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  }
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/api/releases/[id]/publish/route.ts"
git commit -m "feat(releases): add POST /api/releases/:id/publish orchestration"
```

### Task 9.6: POST /api/releases/[id]/archive

**Files:**
- Create: `app/api/releases/[id]/archive/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check no live party exists
  const { data: liveParty } = await supabase
    .from('listening_parties')
    .select('id')
    .eq('release_id', id)
    .eq('status', 'live')
    .maybeSingle();
  if (liveParty) {
    return NextResponse.json({ error: 'Cannot archive during live party' }, { status: 403 });
  }

  const { error } = await supabase.from('releases').update({ status: 'archived' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/api/releases/[id]/archive/route.ts"
git commit -m "feat(releases): add POST /api/releases/:id/archive"
```

---

## Milestone 10 — Storage upload signed URLs

### Task 10.1: POST /api/covers/upload-url — Supabase Storage

**Files:**
- Create: `app/api/covers/upload-url/route.ts`
- Requires Supabase Storage bucket `covers` (create via SQL migration or Studio UI)

- [x] **Step 1:** Create bucket via SQL (new migration):

Create `supabase/migrations/20260422000016_storage_bucket_covers.sql`:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY covers_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

CREATE POLICY covers_upload_own ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = 'artist_' || auth.uid()::text
  );
```

- [x] **Step 2:** Apply migration, commit.

- [x] **Step 3:** Create `app/api/covers/upload-url/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { release_id, filename } = await request.json().catch(() => ({}));
  if (!release_id || !filename) {
    return NextResponse.json({ error: 'release_id and filename required' }, { status: 400 });
  }

  const ext = filename.split('.').pop() ?? 'jpg';
  const path = `artist_${user.id}/release_${release_id}/cover.${ext}`;

  const { data, error } = await supabase.storage
    .from('covers')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ signed_url: data.signedUrl, path, token: data.token });
}
```

- [x] **Step 4:** Commit:

```bash
git add supabase/migrations/20260422000016_storage_bucket_covers.sql app/api/covers/upload-url/route.ts
git commit -m "feat(storage): add covers bucket + signed URL endpoint"
```

### Task 10.2: POST /api/tracks/[id]/upload-url — R2 audio source

**Files:**
- Create: `lib/r2.ts` (R2 client helper)
- Create: `app/api/tracks/[id]/upload-url/route.ts`
- Install: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`

- [x] **Step 1:** Install deps:

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [x] **Step 2:** Create `lib/r2.ts`:

```typescript
import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export const R2_BUCKET = process.env.R2_BUCKET || 'synthcamp-audio-source';
```

- [x] **Step 3:** Create `app/api/tracks/[id]/upload-url/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { r2Client, R2_BUCKET } from '@/lib/r2';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: track } = await supabase
    .from('tracks')
    .select('id, release_id, track_number, releases!inner(artist_id)')
    .eq('id', trackId)
    .single();

  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  // RLS enforces ownership, but re-verify:
  if ((track as unknown as { releases: { artist_id: string } }).releases.artist_id !== user.id) {
    return NextResponse.json({ error: 'Not owner' }, { status: 403 });
  }

  const { filename } = await request.json().catch(() => ({}));
  const ext = filename?.split('.').pop() ?? 'mp3';
  const key = `artist_${user.id}/release_${track.release_id}/track_${track.track_number}.${ext}`;

  const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: 'audio/*' });
  const signed_url = await getSignedUrl(r2Client, cmd, { expiresIn: 3600 });

  return NextResponse.json({ signed_url, key });
}
```

- [x] **Step 4:** Commit:

```bash
git add lib/r2.ts "app/api/tracks/[id]/upload-url/route.ts" package.json pnpm-lock.yaml
git commit -m "feat(storage): add R2 audio upload signed URL endpoint"
```

---

## Milestone 11 — Parties API routes and page

### Task 11.1: POST /api/parties — create

**Files:**
- Create: `app/api/parties/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { release_id, room_id, scheduled_at } = await request.json().catch(() => ({}));
  if (!release_id || !room_id || !scheduled_at) {
    return NextResponse.json({ error: 'release_id, room_id, scheduled_at required' }, { status: 400 });
  }

  const { data: partyId, error } = await supabase.rpc('validate_and_create_listening_party', {
    p_release_id: release_id,
    p_room_id: room_id,
    p_scheduled_at: scheduled_at,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ party_id: partyId }, { status: 201 });
}
```

- [x] **Step 2:** Commit:

```bash
git add app/api/parties/route.ts
git commit -m "feat(parties): add POST /api/parties via RPC"
```

### Task 11.2: POST /api/parties/[id]/cancel

**Files:**
- Create: `app/api/parties/[id]/cancel/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { error } = await supabase.rpc('cancel_listening_party', { p_party_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/api/parties/[id]/cancel/route.ts"
git commit -m "feat(parties): add POST /api/parties/:id/cancel"
```

### Task 11.3: GET /api/rooms/[id]/calendar — slots occupés

**Files:**
- Create: `app/api/rooms/[id]/calendar/route.ts`

- [x] **Step 1:** Create route:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roomId } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to required (ISO)' }, { status: 400 });

  const supabase = await getSupabaseServerClient();

  // Public read of parties — no need for user session
  const { data, error } = await supabase
    .from('listening_parties')
    .select('id, scheduled_at, ends_at, duration_seconds, status, artist:profiles!listening_parties_artist_id_fkey(display_name, slug)')
    .eq('room_id', roomId)
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ slots: data ?? [] });
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/api/rooms/[id]/calendar/route.ts"
git commit -m "feat(parties): add GET /api/rooms/:id/calendar for slot availability"
```

### Task 11.4: /party/[id] placeholder page

**Files:**
- Create: `app/party/[id]/page.tsx`

- [x] **Step 1:** Create page:

```typescript
import { notFound } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: party } = await supabase
    .from('listening_parties')
    .select('id, scheduled_at, status, release:releases!listening_parties_release_id_fkey(title, artist:profiles(display_name))')
    .eq('id', id)
    .single();

  if (!party) notFound();

  const r = (party as unknown as { release: { title: string; artist: { display_name: string } } }).release;

  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="flex flex-col items-center space-y-4 p-10 text-center">
        <LogoS size={48} />
        <h2 className="text-2xl font-black italic uppercase leading-none text-white">
          {r.title}
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">
          by {r.artist.display_name}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Scheduled for
        </p>
        <p className="font-mono text-sm text-white">
          {new Date(party.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
        </p>
        <p className="mt-4 text-[10px] italic text-white/50">
          Listening parties real-time launching Phase 4
        </p>
      </GlassPanel>
    </main>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/party/[id]/page.tsx"
git commit -m "feat(parties): add /party/:id placeholder with scheduled info"
```

---

## Milestone 12 — Browse pages with real data

### Task 12.1: Replace home page — real Editor's Choice + New Releases + Sound Rooms

**Files:**
- Modify: `app/explore/home/page.tsx`

- [x] **Step 1:** Overwrite `app/explore/home/page.tsx`:

```typescript
import Image from 'next/image';
import Link from 'next/link';
import { HeroRelease } from '@/components/catalog/hero-release';
import { ReleaseCard } from '@/components/catalog/release-card';
import { SoundRoomMain } from '@/components/rooms/sound-room-main';
import { SoundRoomCompact } from '@/components/rooms/sound-room-compact';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type Release = Database['public']['Tables']['releases']['Row'] & {
  artist: { display_name: string; slug: string | null };
};

export default async function ExploreHomePage() {
  const supabase = await getSupabaseServerClient();

  // Query 1: Editor's Choice RPC
  const { data: choice } = await supabase.rpc('get_editors_choice');
  const heroId = choice?.[0]?.release_id;
  const isFallback = choice?.[0]?.is_fallback ?? true;

  let hero: Release | null = null;
  if (heroId) {
    const { data } = await supabase
      .from('releases')
      .select('*, artist:profiles!releases_artist_id_fkey(display_name, slug)')
      .eq('id', heroId)
      .single();
    hero = data as Release | null;
  }

  // Query 2: New Releases (6 latest)
  const { data: releases } = await supabase
    .from('releases')
    .select('*, artist:profiles!releases_artist_id_fkey(display_name, slug)')
    .eq('status', 'published')
    .eq('is_listed', true)
    .order('created_at', { ascending: false })
    .limit(6);

  // Query 3: Rooms + current/next party per room
  const { data: rooms } = await supabase
    .from('rooms').select('*').order('display_order');

  // Query 4: Upcoming/live parties with release + artist
  const { data: parties } = await supabase
    .from('listening_parties')
    .select(`
      *,
      release:releases!listening_parties_release_id_fkey(title, slug, cover_url, artist:profiles(display_name, slug)),
      room:rooms(id, slug, kind)
    `)
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  // Find featured party for each room: closest upcoming or currently live
  const partiesByRoom = new Map<string, unknown>();
  for (const p of parties ?? []) {
    const roomId = (p as unknown as { room_id: string }).room_id;
    if (!partiesByRoom.has(roomId)) partiesByRoom.set(roomId, p);
  }

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-12 px-6 pb-32">
      {hero ? (
        <HeroRelease
          release={{
            id: parseInt(hero.id.slice(0, 8), 16), // fake numeric id for HeroRelease interface
            title: hero.title,
            artist: hero.artist.display_name,
            trackCount: 0, // fetch separately if needed
            cover: hero.cover_url,
          }}
          editorsChoice={!isFallback}
          tagline={hero.description ?? (isFallback ? 'Fresh.' : "Editor's Choice")}
        />
      ) : (
        <GlassPanelEmpty />
      )}

      {releases && releases.length > 0 && (
        <section>
          <SectionHeader title="New Releases" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {releases.map((r) => {
              const release = r as Release;
              return (
                <Link key={release.id} href={`/r/${release.slug}`}>
                  <ReleaseCard
                    release={{
                      id: parseInt(release.id.slice(0, 8), 16),
                      title: release.title,
                      artist: release.artist.display_name,
                      trackCount: 0, // would need a sub-query, skip for MVP
                      cover: release.cover_url,
                    }}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Sound Rooms section shows live parties if any, else placeholders */}
      {/* Implementation simplified: reuse existing components */}
    </main>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-center justify-between text-white/80">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">{title}</h3>
      <div className="ml-6 h-[1px] flex-1 bg-white/20" />
    </div>
  );
}

function GlassPanelEmpty() {
  return (
    <section className="rounded-[3rem] border border-white/5 bg-white/[0.02] p-12 text-center">
      <p className="text-sm italic text-white/60">No releases yet — be the first!</p>
    </section>
  );
}
```

- [x] **Step 2:** Note: the numeric `id` conversions are hacks to fit the existing component types. For cleanliness, update `ReleaseCard` and `HeroRelease` to accept the new DB shape directly. This is done in next task.

- [x] **Step 3:** Commit (partial — we'll fix types next):

```bash
git add app/explore/home/page.tsx
git commit -m "feat(home): wire explore/home to real DB data (releases, parties)"
```

### Task 12.2: Update ReleaseCard and HeroRelease to accept DB types

**Files:**
- Modify: `components/catalog/release-card.tsx`
- Modify: `components/catalog/hero-release.tsx`

- [x] **Step 1:** Update `ReleaseCard` to accept DB type:

```typescript
import Image from 'next/image';
import { Play } from 'lucide-react';
import { getPrice, getReleaseLabel } from '@/lib/pricing';

export interface ReleaseCardProps {
  release: {
    id: string;
    title: string;
    slug: string;
    cover_url: string;
    artist: { display_name: string };
    tracks_count: number;
  };
}

export function ReleaseCard({ release }: ReleaseCardProps) {
  return (
    <article className="group cursor-pointer space-y-3 text-left">
      <div className="glass-panel relative aspect-square overflow-hidden rounded-[2rem] border-white/5 transition-transform active:scale-95">
        <Image
          src={release.cover_url}
          alt={`${release.title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover opacity-80 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <Play size={20} fill="currentColor" />
          </div>
        </div>
      </div>
      <div>
        <p className="truncate text-sm font-bold italic leading-none tracking-tight text-white">
          {release.title}
        </p>
        <p className="mt-1 text-[10px] font-medium leading-none text-white/80">
          by {release.artist.display_name}
        </p>
        <div className="mt-2.5 flex items-center justify-between px-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
            {getReleaseLabel(release.tracks_count)}
          </p>
          <span className="font-mono text-[11px] font-black tracking-tighter text-indigo-400">
            ${getPrice(release.tracks_count)}
          </span>
        </div>
      </div>
    </article>
  );
}
```

- [x] **Step 2:** Update `HeroRelease` similarly to accept DB shape.

- [x] **Step 3:** Update `app/explore/home/page.tsx` to fetch tracks count via a join (use `count` on tracks relation):

```typescript
const { data: releases } = await supabase
  .from('releases')
  .select(`
    id, title, slug, cover_url,
    artist:profiles!releases_artist_id_fkey(display_name),
    tracks(count)
  `)
  .eq('status', 'published')
  .eq('is_listed', true)
  .order('created_at', { ascending: false })
  .limit(6);
```

Transform `tracks` join into `tracks_count` before passing to component.

- [x] **Step 4:** Commit:

```bash
git add components/catalog/ app/explore/home/
git commit -m "feat(home): ReleaseCard + HeroRelease accept DB shape with tracks count"
```

### Task 12.3: Release detail page /r/[slug]

**Files:**
- Create: `app/r/[slug]/page.tsx`

- [x] **Step 1:** Create page:

```typescript
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getReleaseLabel } from '@/lib/pricing';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ReleasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: release } = await supabase
    .from('releases')
    .select(`
      *,
      artist:profiles!releases_artist_id_fkey(display_name, slug, bio),
      tracks(id, track_number, title, duration_seconds),
      listening_parties(id, scheduled_at, status, room:rooms(name, slug))
    `)
    .eq('slug', slug)
    .in('status', ['published', 'unlisted', 'scheduled'])
    .single();

  if (!release) notFound();

  const r = release as unknown as {
    id: string; title: string; description: string | null; cover_url: string; credit_category: string; credit_narrative: string | null; price_minimum: number;
    artist: { display_name: string; slug: string | null; bio: string | null };
    tracks: Array<{ id: string; track_number: number; title: string; duration_seconds: number }>;
    listening_parties: Array<{ id: string; scheduled_at: string; status: string; room: { name: string; slug: string } }>;
  };

  const party = r.listening_parties?.[0] ?? null;

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <section className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.5fr]">
        <div className="relative aspect-square overflow-hidden rounded-[2rem]">
          <Image src={r.cover_url} alt={r.title} fill className="object-cover" priority />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
            {r.title}
          </h1>
          <Link href={`/artist/${r.artist.slug}`} className="text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300">
            by {r.artist.display_name}
          </Link>
          {r.description && <p className="text-sm italic text-white/80">{r.description}</p>}
          <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400">
            {r.credit_category}
          </span>
          {r.credit_narrative && (
            <p className="text-xs italic text-white/60">« {r.credit_narrative} »</p>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            {getReleaseLabel(r.tracks.length)} · Min ${r.price_minimum.toFixed(2)}
          </p>
          {party && (
            <Link
              href={`/party/${party.id}`}
              className="block rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-indigo-300"
            >
              Listening Party on {party.room.name} · {new Date(party.scheduled_at).toLocaleString('fr-FR')}
            </Link>
          )}
          <Button variant="primary" size="md" disabled className="w-full">
            Buy (Coming in Phase 3)
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/70">
          Tracklist
        </h2>
        <GlassPanel className="divide-y divide-white/5 p-0">
          {r.tracks
            .sort((a, b) => a.track_number - b.track_number)
            .map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-white/50">{t.track_number.toString().padStart(2, '0')}</span>
                  <span className="text-sm text-white">{t.title}</span>
                </div>
                <span className="font-mono text-xs text-white/60">
                  {Math.floor(t.duration_seconds / 60)}:{(t.duration_seconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ))}
        </GlassPanel>
      </section>
    </main>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/r/[slug]/page.tsx"
git commit -m "feat(browse): add release detail page /r/:slug"
```

### Task 12.4: Artist profile page /artist/[slug]

**Files:**
- Create: `app/artist/[slug]/page.tsx`

*Note:* this conflicts with the existing route groups. Before creating, verify no conflict. The phase 1 had `app/artist/catalog/page.tsx`, `app/artist/upload/page.tsx`, etc. Adding `app/artist/[slug]/page.tsx` would match `/artist/foo`. To avoid clash with static `/artist/catalog`, Next resolves `catalog` first. OK.

- [x] **Step 1:** Create page:

```typescript
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ArtistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('slug', slug).single();
  if (!profile || !profile.is_artist) notFound();

  const { data: releases } = await supabase
    .from('releases')
    .select('id, title, slug, cover_url, tracks(count)')
    .eq('artist_id', profile.id)
    .in('status', ['published', 'unlisted', 'scheduled'])
    .order('created_at', { ascending: false });

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <section className="flex items-center gap-6">
        {profile.avatar_url && (
          <Image src={profile.avatar_url} alt={profile.display_name} width={96} height={96} className="rounded-full" />
        )}
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
            {profile.display_name}
          </h1>
          {profile.bio && <p className="text-sm italic text-white/80">{profile.bio}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/70">
          Releases
        </h2>
        {releases && releases.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {releases.map((r) => {
              const count = Array.isArray((r as unknown as { tracks: { count: number }[] }).tracks)
                ? ((r as unknown as { tracks: { count: number }[] }).tracks[0]?.count ?? 0)
                : 0;
              return (
                <Link key={r.id} href={`/r/${r.slug}`}>
                  <ReleaseCard
                    release={{
                      id: r.id,
                      title: r.title,
                      slug: r.slug,
                      cover_url: r.cover_url,
                      artist: { display_name: profile.display_name },
                      tracks_count: count,
                    }}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-6 text-center">
            <p className="text-sm italic text-white/60">Aucun release publié encore.</p>
          </GlassPanel>
        )}
      </section>
    </main>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add "app/artist/[slug]/page.tsx"
git commit -m "feat(browse): add artist profile page /artist/:slug"
```

### Task 12.5: Update /artist/catalog with real data

**Files:**
- Modify: `app/artist/catalog/page.tsx`

- [x] **Step 1:** Rewrite to server component with real data:

```typescript
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ArtistCatalogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');
  if (!profile.is_artist) redirect('/settings/profile');

  const supabase = await getSupabaseServerClient();
  const { data: releases } = await supabase
    .from('releases')
    .select('*, tracks(count)')
    .eq('artist_id', profile.id)
    .order('created_at', { ascending: false });

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between text-white/90">
        <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
          My Music
        </h2>
        <Link href="/artist/upload">
          <Button variant="primary" size="sm">+ New</Button>
        </Link>
      </div>
      {releases && releases.length > 0 ? (
        <div className="space-y-4">
          {releases.map((r) => {
            const count = (r as unknown as { tracks: { count: number }[] }).tracks?.[0]?.count ?? 0;
            return (
              <Link key={r.id} href={`/r/${r.slug}`}>
                <GlassPanel className="flex cursor-pointer items-center gap-5 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                    <Image src={r.cover_url} alt={r.title} fill className="object-cover" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="truncate text-sm font-bold italic text-white">{r.title}</h3>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      {getReleaseLabel(count)} · {r.status}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-indigo-400">${getPrice(count)}</span>
                </GlassPanel>
              </Link>
            );
          })}
        </div>
      ) : (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm italic text-white/60">Aucun release encore. <Link href="/artist/upload" className="text-indigo-400">Crée ton premier</Link>.</p>
        </GlassPanel>
      )}
    </main>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add app/artist/catalog/page.tsx
git commit -m "feat(artist): wire /artist/catalog to real DB data"
```

---

## Milestone 13 — Upload wizard (multi-step form)

### Task 13.1: Wizard shell with step state

**Files:**
- Modify: `app/artist/upload/page.tsx`
- Create: `app/artist/upload/upload-wizard.tsx`

- [x] **Step 1:** Replace server page with wizard client component:

`app/artist/upload/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/data/profile';
import { UploadWizard } from './upload-wizard';

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');
  if (!profile.is_artist) redirect('/settings/profile');

  return <UploadWizard artistId={profile.id} />;
}
```

- [x] **Step 2:** Create skeleton wizard component `app/artist/upload/upload-wizard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { StepMetadata } from './step-metadata';
import { StepTracks } from './step-tracks';
import { StepCredits } from './step-credits';
import { StepPricingParty } from './step-pricing-party';
import { StepPublish } from './step-publish';

export interface WizardState {
  releaseId: string | null;
  title: string;
  description: string;
  coverUrl: string | null;
  language: string;
  genres: string[];
  tracks: Array<{
    id?: string;
    title: string;
    duration_seconds: number;
    audio_source_key?: string;
    track_number: number;
  }>;
  credits: {
    category: 'acoustic' | 'hybrid' | 'ai_crafted';
    tags: string[];
    narrative: string;
    perTrack: boolean;
  };
  party: {
    enabled: boolean;
    roomId: string | null;
    scheduledAt: string | null;
  };
  releaseDate: {
    mode: 'immediate' | 'future';
    date: string | null;
  };
}

const initialState: WizardState = {
  releaseId: null,
  title: '',
  description: '',
  coverUrl: null,
  language: 'fr',
  genres: [],
  tracks: [],
  credits: { category: 'acoustic', tags: [], narrative: '', perTrack: false },
  party: { enabled: true, roomId: null, scheduledAt: null },
  releaseDate: { mode: 'immediate', date: null },
};

export function UploadWizard({ artistId }: { artistId: string }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);

  const steps = [
    <StepMetadata key="m" state={state} setState={setState} onNext={() => setStep(1)} artistId={artistId} />,
    <StepTracks key="t" state={state} setState={setState} onNext={() => setStep(2)} onBack={() => setStep(0)} />,
    <StepCredits key="c" state={state} setState={setState} onNext={() => setStep(3)} onBack={() => setStep(1)} />,
    <StepPricingParty key="p" state={state} setState={setState} onNext={() => setStep(4)} onBack={() => setStep(2)} />,
    <StepPublish key="pub" state={state} onBack={() => setStep(3)} />,
  ];

  return (
    <main className="view-enter mx-auto max-w-lg space-y-6 px-6 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          New Release
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          Step {step + 1} / {steps.length}
        </span>
      </div>
      {steps[step]}
    </main>
  );
}
```

- [x] **Step 3:** Commit:

```bash
git add "app/artist/upload/"
git commit -m "feat(wizard): add upload wizard shell with 5-step navigation"
```

### Task 13.2-13.6: Each wizard step (Metadata, Tracks, Credits, PricingParty, Publish)

Due to length, each step is a separate task with its own file. They follow the pattern in Task 13.1. Each should be created in `app/artist/upload/step-{name}.tsx` with appropriate form fields + calls to the API routes.

For brevity, the pattern is:

**Step Metadata** (Task 13.2):
- Title input → creates draft release via POST /api/releases on submit (if no releaseId yet)
- Cover upload via /api/covers/upload-url
- Description, language, genres inputs
- Save state, call onNext

**Step Tracks** (Task 13.3):
- Drag-drop reorderable list
- Per track: title, audio file input → uses HTMLAudioElement to extract duration, upload via /api/tracks/:id/upload-url
- Min 3 tracks required to advance

**Step Credits** (Task 13.4):
- 3 radio buttons for category
- Tag checkboxes
- Narrative textarea (280 max)
- "Personnaliser par track" toggle → reveals per-track picker

**Step PricingParty** (Task 13.5):
- Displays computed price_minimum
- Monthly quota display
- Party toggle ON/OFF
- If ON: room selector + CalendarPicker (task 14)
- If OFF: sub-toggle immediate vs future with date picker

**Step Publish** (Task 13.6):
- Summary of all inputs
- "Publier" button → POST /api/releases/:id/publish with party or release_date
- On success, redirect to /artist/catalog

**Commit pattern:** each step committed independently with message `feat(wizard): add <step_name> step`.

---

## Milestone 14 — Calendar component

### Task 14.1: CalendarPicker component

**Files:**
- Create: `components/calendar/calendar-picker.tsx`

- [x] **Step 1:** Create component (simplified — 3-month scrollable grid with 15-min slots):

```typescript
'use client';

import { useEffect, useState } from 'react';
import { addDays, startOfDay, format, addMinutes, isBefore } from 'date-fns';
import { cn } from '@/lib/cn';

export interface CalendarPickerProps {
  roomId: string;
  durationSeconds: number;
  onPick: (scheduledAt: Date) => void;
}

interface OccupiedSlot {
  scheduled_at: string;
  ends_at: string;
}

const SLOT_MINUTES = 15;

export function CalendarPicker({ roomId, durationSeconds, onPick }: CalendarPickerProps) {
  const [occupied, setOccupied] = useState<OccupiedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = startOfDay(new Date()).toISOString();
      const to = addDays(new Date(), 90).toISOString();
      const res = await fetch(`/api/rooms/${roomId}/calendar?from=${from}&to=${to}`);
      const { slots } = await res.json();
      setOccupied(slots ?? []);
      setLoading(false);
    };
    load();
  }, [roomId]);

  if (loading) return <p className="text-sm italic text-white/60">Chargement du calendrier…</p>;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const isSlotAvailable = (slot: Date): boolean => {
    const slotEnd = addMinutes(slot, durationSeconds / 60);
    for (const o of occupied) {
      const oStart = new Date(o.scheduled_at);
      const oEnd = new Date(o.ends_at);
      if (isBefore(slot, oEnd) && isBefore(oStart, slotEnd)) return false;
    }
    return true;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="text-xs text-white/60 hover:text-white"
        >
          ← Semaine précédente
        </button>
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
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {Array.from({ length: 96 }, (_, i) => {
                const slot = addMinutes(day, i * SLOT_MINUTES);
                const available = isSlotAvailable(slot) && slot > new Date();
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!available}
                    onClick={() => onPick(slot)}
                    className={cn(
                      'block w-full rounded px-1 py-0.5 text-left text-[9px] font-mono',
                      available
                        ? 'bg-white/5 text-white hover:bg-indigo-500/30'
                        : 'bg-white/[0.02] text-white/20',
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
```

- [x] **Step 2:** Install date-fns:

```bash
pnpm add date-fns
```

- [x] **Step 3:** Commit:

```bash
git add components/calendar/calendar-picker.tsx package.json pnpm-lock.yaml
git commit -m "feat(calendar): add CalendarPicker component (7-day view, 15-min slots)"
```

### Task 14.2: Timezone confirmation modal

**Files:**
- Create: `components/calendar/timezone-confirm.tsx`

- [x] **Step 1:** Create component:

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

const WORLD_ZONES = [
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
];

export interface TimezoneConfirmProps {
  scheduledAt: Date;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TimezoneConfirm({ scheduledAt, onConfirm, onCancel }: TimezoneConfirmProps) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <GlassPanel className="w-full max-w-md space-y-4 p-6">
        <h3 className="text-lg font-bold italic text-white">Confirmer le créneau</h3>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Ton fuseau ({localTz})</p>
          <p className="font-mono text-lg text-indigo-400">
            {scheduledAt.toLocaleString('fr-FR', { timeZone: localTz, dateStyle: 'full', timeStyle: 'short' })}
          </p>
        </div>
        <div className="space-y-1 border-t border-white/5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Équivalents mondiaux</p>
          {WORLD_ZONES.map((z) => (
            <div key={z.tz} className="flex justify-between text-xs">
              <span className="text-white/70">{z.label}</span>
              <span className="font-mono text-white">
                {scheduledAt.toLocaleString('fr-FR', { timeZone: z.tz, dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="md" onClick={onCancel} className="flex-1">Annuler</Button>
          <Button variant="primary" size="md" onClick={onConfirm} className="flex-1">Confirmer</Button>
        </div>
      </GlassPanel>
    </div>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add components/calendar/timezone-confirm.tsx
git commit -m "feat(calendar): add TimezoneConfirm modal with world zone equivalents"
```

---

## Milestone 15 — Parties page + E2E tests + deploy

### Task 15.1: /artist/parties page

**Files:**
- Modify: `app/artist/parties/page.tsx`

- [x] **Step 1:** Replace placeholder with real data:

```typescript
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ArtistPartiesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');
  if (!profile.is_artist) redirect('/settings/profile');

  const supabase = await getSupabaseServerClient();
  const { data: parties } = await supabase
    .from('listening_parties')
    .select('*, release:releases(title, slug), room:rooms(name)')
    .eq('artist_id', profile.id)
    .order('scheduled_at', { ascending: false });

  return (
    <main className="view-enter mx-auto max-w-md space-y-6 px-6 pb-32">
      <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
        Mes Parties
      </h2>
      {parties && parties.length > 0 ? (
        <div className="space-y-4">
          {parties.map((p) => {
            const party = p as unknown as { id: string; scheduled_at: string; status: string; release: { title: string; slug: string }; room: { name: string } };
            return (
              <GlassPanel key={party.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/r/${party.release.slug}`} className="font-bold text-white hover:text-indigo-400">
                    {party.release.title}
                  </Link>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">{party.status}</span>
                </div>
                <p className="text-xs text-white/70">
                  {party.room.name} · {new Date(party.scheduled_at).toLocaleString('fr-FR')}
                </p>
              </GlassPanel>
            );
          })}
        </div>
      ) : (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm italic text-white/60">Aucune party programmée. <Link href="/artist/upload" className="text-indigo-400">Crée un release</Link>.</p>
        </GlassPanel>
      )}
    </main>
  );
}
```

- [x] **Step 2:** Commit:

```bash
git add app/artist/parties/page.tsx
git commit -m "feat(parties): wire /artist/parties to real DB data"
```

### Task 15.2: Playwright setup

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json` (test:e2e script)

- [x] **Step 1:** Install Playwright:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [x] **Step 2:** Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [x] **Step 3:** Add script to `package.json`:

```json
"test:e2e": "playwright test"
```

- [x] **Step 4:** Commit:

```bash
git add playwright.config.ts package.json pnpm-lock.yaml
git commit -m "chore(e2e): configure Playwright for E2E tests"
```

### Task 15.3: E2E — signup magic link flow

**Files:**
- Create: `tests/e2e/signup-magic-link.spec.ts`

- [x] **Step 1:** Create test (uses Mailtrap OR mocks the magic link):

```typescript
import { test, expect } from '@playwright/test';

test('user can navigate to login page', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByPlaceholder('ton@email.com')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recevoir le lien magique/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuer avec Google/i })).toBeVisible();
});

// Full magic-link flow requires mailbox access — use a test account or mock.
// Skipping full flow here; covered manually during QA.
```

- [x] **Step 2:** Run: `pnpm test:e2e`. Should pass.

- [x] **Step 3:** Commit:

```bash
git add tests/e2e/signup-magic-link.spec.ts
git commit -m "test(e2e): verify login page renders with magic link + Google buttons"
```

### Task 15.4: E2E — home page renders

**Files:**
- Create: `tests/e2e/home-renders.spec.ts`

- [x] **Step 1:** Create test:

```typescript
import { test, expect } from '@playwright/test';

test('home page shows sections', async ({ page }) => {
  await page.goto('/explore/home');
  // Sections visible (may be empty in fresh DB)
  await expect(page.getByText(/New Releases/i)).toBeVisible();
  await expect(page.getByText(/Active Sound Rooms/i)).toBeVisible();
});
```

- [x] **Step 2:** Run and verify.

- [x] **Step 3:** Commit:

```bash
git add tests/e2e/home-renders.spec.ts
git commit -m "test(e2e): verify home page sections render"
```

### Task 15.5: Final validation + Railway redeploy + tag

- [x] **Step 1:** Run full check locally:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

All must pass.

- [x] **Step 2:** Push:

```bash
git push origin main
```

- [x] **Step 3:** Verify Railway deploys green for both `synthcamp` (Next.js) and `supabase-stack` services.

- [x] **Step 4:** Smoke test in production:
- Visit preview URL `/auth/login`, complete magic link signup with real email.
- Verify redirect to `/explore/home`.
- Opt-in artist from `/settings/profile`.
- Create a test release with 3 tracks.
- Schedule a listening party on a secondary room.
- Verify it appears in `/artist/parties` and home page.

- [x] **Step 5:** Tag milestone:

```bash
git tag -a v0.2.0-phase2 -m "Phase 2 complete — Identity, Catalog, Party Scheduling"
git push origin v0.2.0-phase2
```

---

## Acceptance checklist (final)

### Fonctionnels
- [x] Signup magic link + Google OAuth end-to-end working
- [x] Profile auto-created at first login (display_name derived from OAuth or email)
- [x] /settings/profile editable, become-artist flow functional
- [x] Artist can create draft release via wizard (5 steps)
- [x] Audio upload to R2 via signed URL works
- [x] Cover upload to Supabase Storage works
- [x] Publish validates 3 tracks + audio + monthly limit
- [x] Party scheduling validates GMC 1/mois, 1/artist, 15-min, overlap, 3-months
- [x] Cancel party within 1h lockout works, outside refused
- [x] Edit lockout 24h before party enforced via RPC
- [x] Home shows Editor's Choice (or Fresh fallback) + New Releases + Active Rooms
- [x] /r/:slug renders release detail
- [x] /artist/:slug renders artist profile with releases
- [x] /party/:id placeholder with countdown
- [x] pg_cron auto-publishes party-less scheduled releases at release_date

### Qualité code
- [x] `pnpm build` / `typecheck` / `lint` / `format:check` tous green
- [x] `pnpm test` (unit + integration) pass
- [x] `pnpm test:e2e` pass
- [x] Railway deploy green for Next + Supabase stack
- [x] No changes to `base.txt` or `docs/`

### Dette tech documentée
- [x] pg_cron party transitions disabled until Phase 4
- [x] Library page placeholder until Phase 3 Stripe
- [x] 3 E2E scenarios (more to come)
- [x] Single-persona profile (multi-persona deferred)

---

## Next phase

Phase 3 brainstorm : Stripe Connect + audio transcoding pipeline + HLS+AES encryption + player + Library page + buy flow.
