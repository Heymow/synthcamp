# SynthCamp — Sous-projet 2 : Identity + Catalog + Party Scheduling

**Date :** 2026-04-22
**Statut :** Design validé, prêt pour rédaction du plan d'implémentation.
**Auteur :** SynthCamp team (brainstormé avec Claude Code)
**Prérequis :** Phase 1 (Foundation) déployée et taggée `v0.1.1-foundation`.

---

## 1. Contexte

Phase 2 construit le **cœur produit** de SynthCamp : authentification, profils, création de releases avec Creative Credits, scheduling des listening parties sur 3 rooms fixes, et pages browse avec données réelles remplaçant `mock-data.ts`.

Le scope a significativement grossi pendant le brainstorm (intégration du scheduling des listening parties dans la création de release, calendrier shared entre rooms, rate limits multi-niveaux). Estimation réaliste : **~6 semaines solo**.

**Phase 2 ne contient PAS** le commerce Stripe, l'exécution real-time des parties (playback sync, chat, emojis, moderation), ni le player audio. Ces pièces sont Phase 3 et 4.

## 2. Prérequis (Step 0)

Setup initial avant code applicatif :

1. **Créer projet Resend** (SMTP) → récupérer API key pour envois magic link
2. **Créer OAuth app Google** via Google Cloud Console → `CLIENT_ID` + `CLIENT_SECRET`, redirect URL `https://<supabase-domain>/auth/v1/callback`
3. **Provisionner Supabase self-host sur Railway** :
   - Nouveau service dans le projet Railway existant, template docker-compose Supabase community
   - Services à activer : Postgres, GoTrue (auth), PostgREST (REST API), Storage API, Kong gateway
   - Realtime : **désactivé Phase 2** (activé Phase 4)
   - Volumes persistants pour Postgres data
   - Configurer JWT secrets (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`)
   - Configurer GoTrue : Resend SMTP, Google OAuth provider, magic link enabled, password flow disabled
   - Estimer **2-3 jours** de setup/debug réaliste
4. **Provisionner Cloudflare R2 bucket** pour audio sources (`synthcamp-audio-source`), récupérer credentials
5. **Configurer DNS** (si domaine custom) ou utiliser URL Railway par défaut pour Supabase

## 3. Scope

### Inclus dans Phase 2

- Auth : magic link email + Google OAuth via Supabase GoTrue
- Profiles : table unique avec flag `is_artist`, flow opt-in artist
- Release CRUD : title, description, cover, tracks metadata, Creative Credits, PWYW pricing
- Upload audio : fichier source vers R2 (streaming en Phase 3, source juste stockée)
- Creative Credits : taxonomie `acoustic | hybrid | ai_crafted` + tags optionnels, progressive disclosure (optionnel per-track avec auto-computation du global)
- Listening Party scheduling : modèle Party, 3 rooms fixes seedées, UI calendrier par room, sélection de slot avec validation
- Rate limits : 1 GMC/mois par artiste, 1 party active/artiste, 15-min precision
- Edit/Cancel lockouts : edit jusqu'à 24h avant live, cancel jusqu'à 1h avant live
- Status releases : `draft / scheduled / published / unlisted / archived`
- Browse pages avec vraies données :
  - `/explore/home` : hero (Editor's Choice auto / Fresh fallback), New Releases grid, Active Sound Rooms (3 rooms real data)
  - `/r/:slug` : page détail release (cover, tracks, credits, party info, Buy stub)
  - `/artist/:slug` : page profil artiste
  - `/party/:party_id` : waiting room placeholder
  - `/artist/catalog`, `/artist/upload`, `/artist/parties`, `/artist/sales` : pages artist connectées aux données
- Cover storage Supabase Storage bucket public avec Image Transforms
- Tests : unit sur logique critique (pricing, slot validation, rate limits), 2-3 E2E Playwright (signup, release create, party schedule)

### Exclus de Phase 2

- Stripe Connect, `purchases` populées, Library fonctionnelle (Phase 3)
- Audio transcoding FFmpeg, HLS+AES encryption, player réel, streaming (Phase 3)
- Listening party **execution** : playback sync, chat, emojis animés, moderation UI, follow mode, auto-jump, buy-during-party, share link réel (Phase 4)
- pg_cron transitions de party `scheduled → live → ended` — cron **désactivé** en Phase 2, activé Phase 4
- Follow graph artiste, feed, notifications (Phase 6)
- Search avancé avec filters complexes (Phase 5 Discovery)
- Admin dashboard, moderation tools globaux (post-MVP)

### Livrable

`pnpm dev` permet à un user de :
- Se signup via magic link ou Google
- Créer un profil artiste (opt-in)
- Uploader un release avec 3+ tracks, credits, pricing, et optionnellement scheduler une listening party sur une des 3 rooms
- Browser le home en voyant les vraies releases et les parties programmées
- Consulter une page release, un profil artiste
- Voir une waiting room placeholder quand une party est scheduled

Déployé sur Railway avec Supabase self-host opérationnel.

## 4. Stack technique

Hérité de Phase 1 + ajouts Phase 2 :

| Couche | Choix | Notes |
|---|---|---|
| Framework front | Next.js 16 (App Router) | Inchangé |
| DB | Supabase Postgres self-host sur Railway | Nouveau |
| Auth | Supabase GoTrue (magic link + Google OAuth) | Nouveau |
| Storage pochettes | Supabase Storage bucket public avec Transforms | Nouveau |
| Storage audio source | Cloudflare R2 | Nouveau, phase 2 stocke source brute |
| SMTP | Resend | Nouveau, pour magic link |
| DB access | `@supabase/supabase-js` direct + RPC functions | Pas d'ORM |
| Type generation | `supabase gen types typescript` | Types DB → TS automatique |
| Migrations | Supabase CLI (`supabase/migrations/*.sql`) | SQL versionné |
| pg_cron | Installé, mais jobs Phase 2 désactivés | Activé Phase 4 |
| Testing | Vitest (unit) + Playwright (E2E) | Playwright nouveau en Phase 2 |

## 5. Architecture

### 5.1 Principe d'authentification

**Flow magic link :**
1. User entre son email sur `/auth/login`
2. Next API route appelle `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback' } })`
3. GoTrue génère token one-time, Resend envoie email avec lien `https://<supabase>/auth/v1/verify?token=...&redirect_to=/auth/callback`
4. User click → GoTrue vérifie token → redirect vers `/auth/callback` avec session cookie
5. `/auth/callback` accueille le user (crée profile row via trigger si premier login)

**Flow Google OAuth :**
1. User click « Continuer avec Google » sur `/auth/login`
2. `supabase.auth.signInWithOAuth({ provider: 'google' })` redirige vers Google consent
3. Google redirect vers Supabase `/auth/v1/callback` avec code
4. GoTrue exchange code → session
5. Redirect final vers `/auth/callback` de l'app

**Session management :**
- Cookies httpOnly via `@supabase/ssr`
- Server Components ont accès au user via `createServerClient(cookies())`
- Client Components via `createBrowserClient()`
- Middleware Next (`middleware.ts`) refresh la session à chaque request protégée

**Profile creation trigger :**
```sql
CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_artist)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 5.2 Architecture des queries (Supabase client + RPC hybrid)

**Queries simples** : via client chaining
```typescript
// Browse releases
const { data } = await supabase
  .from('releases')
  .select('*, tracks(*), artist:profiles!releases_artist_id_fkey(display_name, avatar_url)')
  .eq('status', 'published')
  .eq('is_listed', true)
  .order('created_at', { ascending: false })
  .limit(20);
```

**Queries complexes** : via Postgres RPC functions
```sql
-- Migration SQL
CREATE FUNCTION public.get_editors_choice() RETURNS TABLE (
  release_id uuid, revenue_30d numeric, is_fallback boolean
) AS $$
  -- Logic: top revenue 30d OR fallback to latest
  ...
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```
```typescript
const { data } = await supabase.rpc('get_editors_choice');
```

Types TS regénérés à chaque migration via :
```bash
supabase gen types typescript --local > lib/database.types.ts
```

### 5.3 Row-Level Security (RLS) strategy

Toutes les tables ont RLS activée. Policies par table (résumé, détail dans migrations) :

- `profiles` : SELECT public, UPDATE si `auth.uid() = id`, INSERT par trigger uniquement
- `releases` : SELECT public si `status IN ('published', 'unlisted')` OR `auth.uid() = artist_id`, INSERT/UPDATE si `auth.uid() = artist_id`, **DELETE refusé par policy `USING false`** — un release se met en `archived`, jamais supprimé (pour préserver l'intégrité des purchases futures)
- `tracks` : mêmes règles que release via JOIN ; DELETE autorisé uniquement si release associé en `draft` (pas encore publié)
- `rooms` : SELECT public, aucun INSERT/UPDATE/DELETE côté user (seedées)
- `listening_parties` : SELECT public, INSERT/UPDATE si `auth.uid() = artist_id` (+ app-layer checks pour rate limits), DELETE refusé (cancellation via `status = 'cancelled'`)
- `party_moderators` : SELECT public, INSERT/DELETE si auth.uid est l'artiste de la party OU modérateur déjà listé (permet délégation en cascade)
- `purchases` : SELECT si `auth.uid() = buyer_id` OR `auth.uid() = release.artist_id` (l'artiste voit ses ventes), INSERT uniquement via RPC Phase 3 (service_role), DELETE refusé

### 5.4 Generic `updated_at` trigger

Pattern standard réutilisé par toutes les tables ayant une colonne `updated_at` :

```sql
CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attaché à chaque table mutable
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER releases_updated_at BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER listening_parties_updated_at BEFORE UPDATE ON public.listening_parties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## 6. Data model (schéma Phase 2 complet)

```sql
-- Extensions requises
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- pour exclusion constraints
CREATE EXTENSION IF NOT EXISTS pg_cron;      -- installé, jobs désactivés Phase 2

-- ENUMS
CREATE TYPE credit_category AS ENUM ('acoustic', 'hybrid', 'ai_crafted');
CREATE TYPE credit_verification_status AS ENUM ('declared', 'pending_review', 'verified');
CREATE TYPE release_status AS ENUM ('draft', 'scheduled', 'published', 'unlisted', 'archived');
CREATE TYPE party_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE room_kind AS ENUM ('global_master', 'secondary');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  slug text UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,50}$'),  -- nullable initialement, requis avant is_artist=true ou première release publiée (app-layer check)
  avatar_url text,
  bio text CHECK (char_length(bio) <= 1000),
  is_artist boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ROOMS (seeded, 3 rows)
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  kind room_kind NOT NULL,
  display_order integer NOT NULL
);

INSERT INTO public.rooms (slug, name, kind, display_order) VALUES
  ('global-master', 'Global Master Channel', 'global_master', 1),
  ('secondary-1', 'Secondary 1', 'secondary', 2),
  ('secondary-2', 'Secondary 2', 'secondary', 3);

-- RELEASES
CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  description text CHECK (char_length(description) <= 2000),
  cover_url text NOT NULL,
  language text CHECK (char_length(language) = 2),  -- ISO 639-1
  genres text[] NOT NULL DEFAULT '{}' CHECK (array_length(genres, 1) IS NULL OR array_length(genres, 1) <= 5),
  price_minimum numeric(10,2) NOT NULL CHECK (price_minimum >= 0),
  credit_category credit_category NOT NULL,
  credit_tags text[] NOT NULL DEFAULT '{}',
  credit_narrative text CHECK (char_length(credit_narrative) <= 280),
  credits_per_track boolean NOT NULL DEFAULT false,
  verification_status credit_verification_status NOT NULL DEFAULT 'declared',
  release_date timestamptz,  -- sémantique (user-sélectionnable dans wizard step 4) :
  -- - Draft : NULL
  -- - Release avec party : release_date = listening_parties.scheduled_at (aligné, pas user-modifiable sans re-scheduling)
  -- - Release sans party + immédiat : release_date = now() au publish
  -- - Release sans party + scheduled futur : release_date = user-pick, max 3 mois ahead
  --   Transition scheduled → published via pg_cron `cron_publish_future_releases` (activé Phase 2)
  status release_status NOT NULL DEFAULT 'draft',
  is_listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TRACKS
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  track_number integer NOT NULL CHECK (track_number BETWEEN 1 AND 100),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  audio_source_key text,  -- R2 path (nullable en draft, NOT NULL requis au publish via RPC)
  hls_manifest_key text,  -- Phase 3 (généré par transcoding)
  aes_key_id uuid,        -- Phase 3
  credit_category credit_category,  -- NULL = inherit release
  credit_tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(release_id, track_number)
);

-- Contraintes au publish (validées par RPC `validate_release_publish`) :
--   1. Min 3 tracks par release
--   2. Tous les tracks ont `audio_source_key NOT NULL` (audio obligatoire)
--   3. Max 2 releases publiés par artiste dans le mois calendaire courant
--   4. Si party : scheduled_at <= now() + interval '3 months' (calendrier max 3 mois)
-- Applied app-layer ou via RPC, pas en DB constraints (agrégats impossibles)

-- LISTENING PARTIES
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
  -- Empêche overlap dans une même room pour parties actives (scheduled ou live)
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(scheduled_at, ends_at) WITH &&
  ) WHERE (status IN ('scheduled', 'live'))
);

-- PARTY MODERATORS
CREATE TABLE public.party_moderators (
  party_id uuid NOT NULL REFERENCES public.listening_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_during_party boolean NOT NULL DEFAULT false,
  PRIMARY KEY (party_id, user_id)
);

-- PURCHASES (schéma Phase 2, populé Phase 3)
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  amount_paid numeric(10,2) NOT NULL CHECK (amount_paid >= 0),
  stripe_payment_intent text UNIQUE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, release_id)
);

-- INDICES
CREATE INDEX idx_releases_artist_status ON public.releases(artist_id, status);
CREATE INDEX idx_releases_status_listed_created ON public.releases(status, is_listed, created_at DESC)
  WHERE status = 'published' AND is_listed = true;
CREATE INDEX idx_parties_room_status ON public.listening_parties(room_id, status, scheduled_at);
CREATE INDEX idx_parties_artist_status ON public.listening_parties(artist_id, status);
CREATE INDEX idx_purchases_release_date ON public.purchases(release_id, purchased_at DESC);
CREATE INDEX idx_tracks_release_number ON public.tracks(release_id, track_number);
```

## 7. RPC Functions (SQL functions exposées via `supabase.rpc()`)

### 7.1 `get_editors_choice()`

Retourne le release pour le hero du home.

```sql
CREATE FUNCTION public.get_editors_choice()
RETURNS TABLE (
  release_id uuid,
  revenue_30d numeric,
  is_fallback boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  top_record record;
BEGIN
  -- Essaie le top revenu sur 30 jours glissants
  SELECT r.id, COALESCE(SUM(p.amount_paid), 0) AS rev
  INTO top_record
  FROM public.releases r
  LEFT JOIN public.purchases p ON p.release_id = r.id
    AND p.purchased_at >= now() - interval '30 days'
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY r.id
  HAVING COALESCE(SUM(p.amount_paid), 0) > 0
  ORDER BY rev DESC, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT top_record.id, top_record.rev, false;
  ELSE
    -- Fallback : le plus récent release publié
    RETURN QUERY
    SELECT r.id, 0::numeric, true
    FROM public.releases r
    WHERE r.status = 'published' AND r.is_listed = true
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;
```

### 7.2 `compute_release_credits_from_tracks(release_id uuid)`

Recompute les credits release depuis les tracks quand `credits_per_track = true`. Appelée via trigger sur UPDATE de `tracks.credit_category` ou `tracks.credit_tags`.

```sql
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
```

Wrapper trigger function (appelle la RPC `compute_release_credits_from_tracks`) :

```sql
CREATE FUNCTION public.trigger_recompute_release_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release_id uuid;
BEGIN
  -- DELETE : utiliser OLD.release_id ; sinon NEW
  v_release_id := COALESCE(NEW.release_id, OLD.release_id);
  PERFORM public.compute_release_credits_from_tracks(v_release_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tracks_credits_update_trigger
AFTER INSERT OR UPDATE OF credit_category, credit_tags OR DELETE ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_release_credits();
```

### 7.3 `validate_and_create_listening_party(...)`

Valide toutes les règles métier et crée la party atomiquement.

```sql
CREATE FUNCTION public.validate_and_create_listening_party(
  p_release_id uuid,
  p_room_id uuid,
  p_scheduled_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_artist_id uuid;
  v_duration integer;
  v_room_kind room_kind;
  v_party_id uuid;
BEGIN
  -- Check release existe et appartient à l'user connecté
  SELECT artist_id INTO v_artist_id FROM public.releases WHERE id = p_release_id;
  IF v_artist_id IS NULL OR v_artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Release not found or not owned';
  END IF;

  -- Party ne peut être créée que pour un release en 'draft' (au moment du publish wizard)
  IF (SELECT status FROM public.releases WHERE id = p_release_id) <> 'draft' THEN
    RAISE EXCEPTION 'Party scheduling only at publish time (release must be in draft status)';
  END IF;

  -- Pas de party active existante pour cet artiste
  IF EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE artist_id = v_artist_id AND status IN ('scheduled', 'live')
  ) THEN
    RAISE EXCEPTION 'Artist already has an active party';
  END IF;

  -- Check room kind
  SELECT kind INTO v_room_kind FROM public.rooms WHERE id = p_room_id;

  -- GMC : 1 par mois calendaire (calcul sur scheduled_at pas now)
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

  -- Max 3 mois ahead (calendar range)
  IF p_scheduled_at > now() + interval '3 months' THEN
    RAISE EXCEPTION 'Cannot schedule more than 3 months ahead';
  END IF;

  -- Compute duration depuis tracks
  SELECT COALESCE(SUM(duration_seconds), 0) INTO v_duration
  FROM public.tracks WHERE release_id = p_release_id;

  IF v_duration <= 0 THEN
    RAISE EXCEPTION 'Release has no tracks';
  END IF;

  -- scheduled_at doit être futur
  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot schedule in the past';
  END IF;

  -- Insert (exclusion constraint vérifiera l'overlap dans la room)
  INSERT INTO public.listening_parties (release_id, artist_id, room_id, scheduled_at, duration_seconds)
  VALUES (p_release_id, v_artist_id, p_room_id, p_scheduled_at, v_duration)
  RETURNING id INTO v_party_id;

  -- Update release status → scheduled
  UPDATE public.releases SET status = 'scheduled', release_date = p_scheduled_at
  WHERE id = p_release_id;

  RETURN v_party_id;
END;
$$;
```

### 7.4 `cancel_listening_party(party_id uuid)`

Vérifie lockout 1h et annule.

```sql
CREATE FUNCTION public.cancel_listening_party(p_party_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_party record;
BEGIN
  SELECT * INTO v_party FROM public.listening_parties WHERE id = p_party_id;

  IF v_party.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not owner';
  END IF;

  IF v_party.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Party is not scheduled';
  END IF;

  IF v_party.scheduled_at - interval '1 hour' < now() THEN
    RAISE EXCEPTION 'Cancel window closed (< 1h before start)';
  END IF;

  UPDATE public.listening_parties SET status = 'cancelled', updated_at = now()
  WHERE id = p_party_id;

  -- Release retombe en draft pour retouches, ou directement en published ?
  -- Décision : retombe en draft, l'artiste décide de republier ou re-scheduler
  UPDATE public.releases SET status = 'draft', release_date = NULL
  WHERE id = v_party.release_id;
END;
$$;
```

### 7.5 `check_release_editable(release_id uuid)`

Helper lu par les API routes avant UPDATE de release/tracks.

```sql
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
```

### 7.6 `cron_publish_future_releases()` — auto-publish des releases schedulées sans party

Phase 2 active un pg_cron job pour transitionner les releases **sans party** dont `release_date` est passée. Party-bearing releases restent en `scheduled` (bascule dans Phase 4).

```sql
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

-- Activé Phase 2 (pg_cron party transitions reste désactivé)
SELECT cron.schedule(
  'publish-future-releases',
  '* * * * *',   -- tick chaque minute
  $$SELECT public.cron_publish_future_releases();$$
);
```

### 7.7 `validate_release_publish(release_id uuid)` — gate de publication

Validation atomique au moment du publish (appelée par la route `POST /api/releases/:id/publish`).

```sql
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
    RAISE EXCEPTION 'Release not found or not owned';
  END IF;

  -- 1. Min 3 tracks
  SELECT COUNT(*) INTO v_track_count FROM public.tracks WHERE release_id = p_release_id;
  IF v_track_count < 3 THEN
    RAISE EXCEPTION 'Minimum 3 tracks required (found %)', v_track_count;
  END IF;

  -- 2. Tous les tracks ont audio_source_key
  SELECT COUNT(*) INTO v_missing_audio FROM public.tracks
  WHERE release_id = p_release_id AND audio_source_key IS NULL;
  IF v_missing_audio > 0 THEN
    RAISE EXCEPTION 'All tracks must have audio uploaded (% missing)', v_missing_audio;
  END IF;

  -- 3. Max 2 releases publiés par artiste dans le mois calendaire courant
  -- (compte les releases avec status in ('scheduled','published','unlisted') dont release_date est dans le mois courant)
  SELECT COUNT(*) INTO v_releases_this_month FROM public.releases
  WHERE artist_id = v_artist_id
    AND status IN ('scheduled', 'published', 'unlisted')
    AND release_date IS NOT NULL
    AND date_trunc('month', release_date) = date_trunc('month', now())
    AND id <> p_release_id;  -- exclut le release qu'on est en train de publier
  IF v_releases_this_month >= 2 THEN
    RAISE EXCEPTION 'Monthly release limit reached (2 per calendar month)';
  END IF;
END;
$$;
```

## 8. Règles métier — récapitulatif

| Règle | Implémentation |
|---|---|
| Release min 3 tracks avant publish | RPC `validate_release_publish` |
| **Audio obligatoire au publish** (tous tracks ont `audio_source_key`) | RPC `validate_release_publish` |
| EP / Album label | Helper `getReleaseLabel` frontend : `trackCount <= 5 ? 'EP' : 'Album'` |
| `price_minimum` = formule | Calculé côté app au publish : `ceil(trackCount * 0.60) - 0.01` |
| **Max 2 releases publiés / artiste / mois calendaire** | RPC `validate_release_publish` |
| **`release_date` sélectionnable** (date + heure, timezone-aware, équivalents mondiaux affichés) | UI wizard step Pricing&Party ; stocké en UTC en DB |
| **Release sans party + immédiat = `release_date = now()`** | App-layer au publish |
| **Release sans party + futur = `release_date` user-pick (max 3 mois)** | App-layer au publish, auto-bascule via pg_cron |
| **Release avec party = `release_date = party.scheduled_at`** | RPC `validate_and_create_listening_party` |
| Auto-publish releases sans party à `release_date` | **pg_cron `cron_publish_future_releases`** (activé Phase 2, tick 1 min) |
| Status transitions release | draft → scheduled (avec party OR futur sans party) OR published (sans party, immédiat) ; scheduled → published auto (pg_cron Phase 2 pour sans-party, Phase 4 pour avec-party) ; anywhere → archived OR unlisted |
| Party slot = 15 min precision | DB CHECK sur `scheduled_at % 900 = 0` |
| Party overlap prevention | EXCLUDE USING gist constraint |
| 1 GMC / artiste / mois calendaire | RPC `validate_and_create_listening_party` |
| 1 party active / artiste (à tout moment) | RPC idem |
| **Calendar max 3 mois ahead** | RPC idem (check `scheduled_at <= now() + interval '3 months'`) |
| 1 party par release | `UNIQUE(release_id)` sur `listening_parties` |
| Edit lockout 24h avant party | RPC `check_release_editable` |
| Cancel lockout 1h avant party | RPC `cancel_listening_party` |
| Release jamais DELETE, seulement archive | RLS `DELETE USING false` sur releases |
| Creative Credits global auto-computed | Trigger sur `tracks` → RPC `compute_release_credits_from_tracks` |
| Editor's Choice | RPC `get_editors_choice` appelé par `/explore/home` |
| `updated_at` auto-refresh sur UPDATE | Triggers `set_updated_at` sur profiles/releases/listening_parties |
| pg_cron transitions party (`scheduled → live → ended`) | **Désactivé Phase 2** (activé Phase 4) |
| pg_cron releases sans party (`scheduled → published`) | **Activé Phase 2** (tick 1 min, safe car pas d'effet side-playback) |
| Party scheduling requiert release.status = `draft` | RPC check en début de `validate_and_create_listening_party` — empêche d'ajouter une party à un release déjà published |
| `releases.slug` generation | API route `POST /api/releases` génère depuis title (kebab-case + suffixe numérique sur collision) |

## 9. UI — pages à construire

### Pages publiques (non-authentifiées)
- `/auth/login` — email input + bouton Google
- `/auth/callback` — handler post-magic-link / post-OAuth, crée session, redirect `/explore/home`
- `/explore/home` — hero Editor's Choice, New Releases grid (6 derniers), Active Sound Rooms (3 rooms real data)
- `/explore/search` — placeholder « Coming soon »
- `/r/:slug` — page détail release (cover, title, artist, description, tracks list, Creative Credits badge, party info si scheduled, Buy button **stub/disabled Phase 2**)
- `/artist/:slug` — profil artiste (avatar, bio, releases grid, party active si any)
- `/party/:party_id` — placeholder « Listening parties launching Phase 4 » (ou countdown simple si scheduled future)

### Pages authentifiées (user logged)
- `/explore/library` — liste des releases achetés (**vide Phase 2**, placeholder « Buy a release to see it here »)
- `/settings/profile` — éditer display_name, avatar, bio, slug, toggle is_artist

### Pages artist (si `profiles.is_artist = true`)
- `/artist/catalog` — liste des releases de l'user connecté (draft + published + archived)
- `/artist/upload` — wizard création/édition release (multi-step form)
- `/artist/parties` — liste des parties schedulées/passées
- `/artist/sales` — placeholder dashboard Phase 3

### Wizard `/artist/upload` — les steps

1. **Metadata** : title, description, cover upload (drag-drop + preview), language, genres (tags input free-form, max 5)
2. **Tracks** : drag-drop réordonnable, par track : titre, **upload audio file obligatoire** (via signed URL R2), duration auto-extraite via `HTMLAudioElement` avant upload. Minimum 3 tracks pour passer à l'étape suivante.
3. **Credits** : category picker (3 boutons : acoustic / hybrid / ai_crafted), tags optionnels (checkboxes), narrative (textarea 280 chars), lien « Personnaliser par track » → section per-track avec picker par track (global recalculé en read-only)
4. **Pricing & Party** :
   - Affiche `price_minimum` calculé depuis nombre de tracks (read-only, helper « Les auditeurs peuvent payer plus s'ils veulent »)
   - Affiche le quota mensuel utilisé (« Tu as publié 1/2 release ce mois »)
   - Toggle « Planifier une listening party » (default ON)
   - Si **ON** :
     - Sélecteur de room (3 cartes radio : Global Master Channel premium + 2 secondaires)
     - Si GMC : indique si l'artiste a déjà utilisé son quota mensuel GMC
     - Calendrier : grid scrollable **3 mois ahead max**, 7 jours par vue, slots 15-min dans chaque jour, slots occupés disabled avec tooltip « Occupé par [Autre Artiste] », slots conflictuels (durée chevaucherait) aussi disabled
     - Au click sur un slot libre → confirmation en modale avec : **date/heure dans le fuseau horaire détecté** (ex: Europe/Paris) + **équivalents dans 5 zones** (LA, NYC, London, Paris, Tokyo) en affichage read-only
     - `release_date` = ce `scheduled_at` automatiquement
   - Si **OFF** (pas de listening party) :
     - Sub-toggle **« Sortie »** : (a) Immédiat | (b) Date future
     - Si (a) Immédiat : `release_date = now()`, status → `published` au submit
     - Si (b) Date future : picker date+heure (timezone détectée + équivalents mondiaux idem step party), max 3 mois ahead, `release_date = user_pick`, status → `scheduled`. Auto-bascule vers `published` via pg_cron `cron_publish_future_releases` quand la date arrive.
     - Message selon le choix : « La release sera visible dès la validation » ou « La release sera publiée automatiquement le [date] »
5. **Publish** : résumé complet (titre, artiste, tracks count + durée totale, prix minimum, party si any), bouton final « Publier »

### Sidebar nav update (Phase 2)

Le mockup avait Artist mode → `catalog`, `upload`, `parties`, `sales`. On garde. Explore mode → `home`, `search`, `library`. On garde.

Nouveauté : option « Devenir artiste » dans `/settings/profile` si `is_artist = false`. Submit déclenche `UPDATE profiles SET is_artist = true WHERE id = auth.uid()` (après vérif que `slug` est défini).

**Opt-out artiste (note UX) :** pas d'action publique pour repasser `is_artist = true → false` en Phase 2 (edge case rare). Si un user le demande, le faire en SQL direct. Si volume réel, ajouter en Phase 6.

**Cancel party — UX (note) :** après cancel, le release revient à `draft`. L'artiste doit repasser par le wizard de publish pour remettre le release en ligne. L'UI de `/artist/parties` affiche un bouton « Republier » qui lance le wizard pré-rempli.

## 10. API routes (Next.js)

### Auth
- `GET /api/auth/callback` — handler Supabase OAuth callback, redirect post-auth

### Profile
- `PATCH /api/profile` — éditer `display_name`, `slug`, `avatar_url`, `bio` (RLS enforces `auth.uid() = id`)
- `POST /api/profile/become-artist` — set `is_artist = true` (vérifie que `slug` est défini avant)

### Storage signed URLs
- `POST /api/covers/upload-url` — retourne signed URL pour upload vers Supabase Storage bucket `covers` (vérifie ownership du release passé en param)
- `POST /api/tracks/:id/upload-url` — retourne signed URL pour upload vers R2 (vérifie ownership du release parent)

### Releases
- `POST /api/releases` — create draft release, génère slug depuis title (kebab-case + suffixe numérique sur collision UNIQUE violation), return `release_id` + slug
- `PATCH /api/releases/:id` — update metadata/credits/pricing (vérifie `check_release_editable` côté RPC)
- `POST /api/releases/:id/tracks` — add track metadata (titre, duration, track_number)
- `PATCH /api/releases/:id/tracks/:trackId` — update track
- `DELETE /api/releases/:id/tracks/:trackId` — remove track (RLS : seulement si release en draft)
- `POST /api/releases/:id/publish` — orchestration du publish :
  1. Appelle RPC `validate_release_publish` (3 tracks min, audio requis, 2/mois max)
  2. Selon payload :
     - Party ON → appelle RPC `validate_and_create_listening_party`
     - Sans party + immédiat → `UPDATE releases SET status='published', release_date=now()`
     - Sans party + futur → `UPDATE releases SET status='scheduled', release_date=<user_date>`
- `POST /api/releases/:id/archive` — `UPDATE releases SET status='archived'` (RLS : artist owner)

### Parties
- `POST /api/parties` — créer party (appelle RPC `validate_and_create_listening_party`)
- `POST /api/parties/:id/cancel` — appelle RPC `cancel_listening_party`
- `GET /api/rooms/:roomId/calendar?from=...&to=...` — retourne slots occupés dans la plage, max range 3 mois

Toutes les routes sont des `route.ts` dans `app/api/.../route.ts`, utilisent `createServerClient` pour récupérer la session user. RLS + RPC font la validation métier. Réponses d'erreur uniformisées : `{ error: { code, message } }` avec status HTTP approprié.

**Slug generation logic** (côté API route POST /api/releases) :
```typescript
// Pseudocode
const base = slugify(title); // kebab-case, ASCII, max 100 chars
let slug = base;
let suffix = 1;
while (await exists(slug)) {
  slug = `${base}-${suffix++}`;
}
```

## 11. Storage configuration

### 11.1 Supabase Storage — bucket `covers`
- Public read (anyone can fetch)
- Upload limité aux users authentifiés avec `auth.uid() = artist_id` du release associé (policy via path `artist_{uid}/release_{rid}/cover.{ext}`)
- Transforms : `?width=500&quality=80` pour grid cards, `?width=1200&quality=90` pour hero

### 11.2 Cloudflare R2 — bucket `synthcamp-audio-source`
- Private, pas d'URL publique
- Upload via signed URL générée par API route `/api/tracks/:id/upload-url` qui vérifie ownership
- Clé : `artist_{uid}/release_{rid}/track_{trackNumber}.{ext}`
- Upload direct browser → R2 (évite proxying le fichier par Railway)

## 12. Testing strategy

### Unit tests (Vitest) — obligatoires sur :
- `lib/pricing.ts` — formule `getPrice` et label `getReleaseLabel` avec cases edges (1, 2, 3, 5, 6, 100 tracks)
- `lib/slug.ts` — génération de slug depuis title (accents, ponctuation, collisions)
- `lib/slots.ts` — validation 15-min precision, computation ends_at, détection overlap

### Integration tests (Vitest avec Supabase local)
- Trigger `handle_new_user` crée profile après auth.users INSERT
- RPC `validate_and_create_listening_party` rejette party avec overlap
- RPC `validate_and_create_listening_party` rejette 2e GMC dans même mois
- RPC `validate_and_create_listening_party` rejette si release.status != 'draft'
- RPC `validate_and_create_listening_party` rejette si scheduled_at > now + 3 mois
- RPC `validate_release_publish` rejette <3 tracks, audio manquant, 2-releases/mois reached
- RPC `cancel_listening_party` rejette après lockout 1h
- Trigger `compute_release_credits_from_tracks` calcule hybrid quand mixed
- pg_cron `cron_publish_future_releases` flip release sans party à `published` quand date passée
- pg_cron ne touche PAS releases avec party active

### E2E Playwright — 3 scénarios critiques
- Signup magic link → profile créé, is_artist=false
- Opt-in artist → créer release 3 tracks → publish sans party → visible dans `/artist/catalog` + `/explore/home` New Releases
- Opt-in artist → créer release → schedule party sur secondary room → visible dans Active Sound Rooms home

### Non-tests
- Upload flow UI interactions (drag-drop, calendrier) : testés manuellement en Phase 2, couverts E2E à l'échantillon
- Edge cases rares (timezone DST boundaries, race conditions multi-user) : non-priorité MVP

## 13. Critères d'acceptation

### Fonctionnels

- Signup/login magic link fonctionne end-to-end (email reçu via Resend, click link, session créée)
- Signup/login Google OAuth fonctionne
- Profile auto-créé au premier login (display_name dérivé du nom Google ou local-part email)
- User peut éditer son profile et opt-in artist
- Artist peut créer un release complet (metadata + 3+ tracks + audio upload + credits + cover upload)
- Artist **ne peut pas publier** un release si : <3 tracks, tracks sans audio, ou 2 releases déjà publiés dans le mois
- Artist peut scheduler une listening party sur une room libre avec validation de toutes les règles (GMC 1/mois, 1 active/artiste, 15min precision, pas d'overlap, max 3 mois ahead)
- Artist peut publier un release **sans party** avec choix : immédiat OU date future (max 3 mois ahead) → pg_cron auto-bascule à `published` à la date choisie
- Calendar du wizard affiche les slots occupés + équivalents horaires mondiaux (LA, NYC, London, Paris, Tokyo) lors de la confirmation
- Slug du release auto-généré depuis title au create (kebab-case, collision-safe avec suffixe numérique)
- Artist peut cancel une party avant lockout 1h
- Artist peut éditer un release avant lockout 24h (si party scheduled)
- Home affiche Editor's Choice auto OU Fresh fallback, New Releases grid, 3 Active Sound Rooms réels
- Release detail page accessible à `/r/:slug` affiche tout le contenu publié
- Artist profile page à `/artist/:slug` affiche bio + releases grid
- Party page `/party/:id` affiche placeholder propre
- Calendar UI `/artist/upload` étape Pricing&Party affiche slots occupés et permet sélection d'un slot libre

### Qualité code

- `pnpm build` passe, `pnpm typecheck` passe (avec types DB generés)
- `pnpm lint` + `pnpm format:check` propres
- `pnpm test` exécute tous les unit + integration tests, ≥ 90 % pass
- `pnpm test:e2e` exécute les 3 Playwright scenarios, tous pass

### Déploiement

- Supabase self-host opérationnel sur Railway (URL accessible, GoTrue répond à `/auth/v1/health`)
- Next app connecté à Supabase, signup réel fonctionne sur preview Railway
- Secrets configurés (Resend API, Google OAuth, R2, Supabase keys)

### A11y

- Nouveau wizard upload navigable au clavier (chaque step Tab-reachable)
- Calendar picker : arrow keys pour naviguer les jours/slots, Enter pour sélectionner
- Focus visible, contrastes ≥ 4.5:1 (conforme standard Phase 1)

### Performance

- `/explore/home` Lighthouse Performance ≥ 80 en mobile (cible assouplie vs 85 Phase 1 car données live, pas static)
- Query budget : `/explore/home` → max 4 queries Supabase (releases, rooms, parties, editor's choice RPC)

## 14. Dette technique carried (mise à jour)

Dans `memory/synthcamp-tech-debt.md` — ajouts Phase 2 :

5. **pg_cron disabled Phase 2** — les parties restent à `status = 'scheduled'` sans transitions auto. Activer en Phase 4. Trigger de bascule : l'implémentation de Realtime execution commence.
6. **Page `/party/:id` placeholder** — implémentation réelle (waiting room + countdown + auto-entry) en Phase 4.
7. **Library page vide** — Phase 3 la remplit avec les purchases réels après Stripe.
8. **Editor's Choice via live query** — pas de materialized view pour MVP. À migrer si nombre de releases dépasse ~1000 ou perf devient un problème.
9. **Test coverage partielle** — unit + integration + 3 E2E. Le tournant full-coverage peut venir en Phase 3 quand argent circule.

## 15. Annexe — variables d'environnement

```bash
# Supabase (self-host Railway)
NEXT_PUBLIC_SUPABASE_URL=https://<supabase-service>.up.railway.app
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Supabase internal (côté Supabase service)
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<random-32-chars>
GOTRUE_SITE_URL=https://<next-app>.up.railway.app
GOTRUE_URI_ALLOW_LIST=https://<next-app>.up.railway.app/auth/callback
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=<resend-api-key>
GOTRUE_SMTP_ADMIN_EMAIL=noreply@synthcamp.com
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google-client-secret>

# Cloudflare R2 (audio source storage)
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET=synthcamp-audio-source
R2_PUBLIC_URL=  # unused phase 2, private bucket

# Application
NEXT_PUBLIC_APP_URL=https://<next-app>.up.railway.app
```

## 16. Prochaine étape

Rédaction du plan d'implémentation détaillé via `superpowers:writing-plans` : milestones setup Supabase self-host, migrations DB, auth flow, profile opt-in, release CRUD, wizard upload, party scheduling + calendar UI, browse pages, tests.
