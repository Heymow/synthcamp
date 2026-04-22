# Supabase self-host on Railway

This folder contains the scaffold to deploy a **Supabase stack** (Postgres + Auth + Storage + REST API + Kong gateway) on Railway.

## Architecture

Services deployed:
- `db` — Postgres 15 with Supabase extensions
- `auth` — GoTrue (authentication via magic link + Google OAuth)
- `rest` — PostgREST (auto-generated REST API from Postgres schema)
- `storage` — Supabase Storage API (file uploads, used for album covers)
- `imgproxy` — Image transformation (resize covers)
- `meta` — postgres-meta (schema introspection)
- `studio` — Supabase Studio (admin UI)
- `kong` — API gateway (single public entry point, routes all the above)

**Realtime is NOT included in Phase 2** — added in Phase 4 for listening party execution.

## Step-by-step setup

### 1. Generate JWT secrets locally

From project root (NOT inside this directory):

```bash
node scripts/generate-jwt-secrets.mjs
```

Copy the entire output. Save in your password manager immediately — the JWT_SECRET cannot be regenerated later without invalidating all user sessions.

### 2. Download the official Supabase docker-compose

```bash
cd supabase-selfhost
bash setup.sh
```

This downloads `docker-compose.yml`, `.env.example`, and `volumes/` from the official Supabase repo (pinned version). It also applies a patch to disable the Realtime service (Phase 4 feature).

### 3. Create your `.env` from the example

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- All values from `node scripts/generate-jwt-secrets.mjs` output
- SMTP config from Brevo (host: `smtp-relay.brevo.com`, port `587`, user: your email, pass: your API key)
- Google OAuth credentials (client ID + secret from Google Cloud Console)
- `SITE_URL` = your Next.js app URL on Railway (or `http://localhost:3000` for dev)
- `API_EXTERNAL_URL` = your Supabase public URL on Railway (known after step 5)

### 4. Deploy to Railway

**Important** — Railway doesn't natively deploy multi-container docker-compose. Two options:

**Option A: Railway community template (easiest)**

1. Go to https://railway.com/new/template
2. Search for "Supabase"
3. Click "Deploy" on a community template (check it matches the services above)
4. Connect your GitHub repo for configuration
5. Paste all env vars from your `.env` into Railway's Variables tab for each service
6. Wait ~5-10 min for services to start
7. Kong gateway service will expose a public URL — this is your `API_EXTERNAL_URL`

**Option B: VPS alternative ($5/mo)**

Railway's docker-compose story is clunky for multi-service stacks. For a smoother self-host experience, consider deploying on a basic VPS (DigitalOcean droplet, Hetzner CX11, etc.):

```bash
ssh root@your-vps
git clone https://github.com/Heymow/synthcamp
cd synthcamp/supabase-selfhost
bash setup.sh
cp .env.example .env && nano .env  # fill in values
docker compose up -d
```

Expose ports via a reverse proxy (Caddy, Nginx) for HTTPS.

Either approach, once up:

### 5. Verify the stack

```bash
curl https://<supabase-public-url>/auth/v1/health
```

Expected: `{"version":"...","name":"GoTrue",...}`

Access Studio UI at `https://<supabase-public-url>` with `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`.

### 6. Give the URL + keys to the Next.js app

Add to `.env.local` in project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-public-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from step 1>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from step 1>
```

On Railway, add the same vars to your `synthcamp` Next.js service Variables.

### 7. Add Supabase public URL to Google OAuth redirect

Go back to Google Cloud Console → OAuth credentials → add:
```
https://<your-supabase-public-url>/auth/v1/callback
```
to Authorized redirect URIs.

## Maintenance

- **Updates** : run `bash setup.sh` again to pull latest compose, then re-deploy
- **Backups** : Railway volume snapshots OR `pg_dump` cronné vers R2
- **Monitoring** : Railway dashboards + logs

## Files in this folder

After `bash setup.sh` runs:
- `docker-compose.yml` — downloaded from Supabase repo (do not edit directly; regenerate via setup.sh to refresh)
- `.env.example` — template, includes all needed vars
- `.env` — YOUR actual secrets (gitignored)
- `volumes/` — Kong config, db init scripts (gitignored except kong.yml)
