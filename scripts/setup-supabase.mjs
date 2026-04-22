#!/usr/bin/env node
/**
 * Downloads the official Supabase self-host docker-compose config
 * and patches it for SynthCamp (disables Realtime — a Phase 4 feature).
 *
 * Cross-platform (Node 22+), no shell required.
 *
 * Usage (from project root):
 *   node scripts/setup-supabase.mjs
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_RELEASE = '2026.01.15';
const BASE_URL = `https://raw.githubusercontent.com/supabase/supabase/${SUPABASE_RELEASE}/docker`;
const SUPABASE_DIR = join(process.cwd(), 'supabase-selfhost');

async function download(url, destPath, { optional = false } = {}) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (optional) {
        console.warn(`  ⚠  ${url} returned ${res.status} — skipping (optional)`);
        return false;
      }
      throw new Error(`HTTP ${res.status} on ${url}`);
    }
    const content = await res.text();
    await writeFile(destPath, content);
    return true;
  } catch (err) {
    if (optional) {
      console.warn(`  ⚠  Failed to fetch ${url}: ${err.message}`);
      return false;
    }
    throw err;
  }
}

async function patchRealtimeOut() {
  const composePath = join(SUPABASE_DIR, 'docker-compose.yml');
  let content = await readFile(composePath, 'utf8');

  // Match the realtime service block: from "  realtime:" until the next top-level
  // 2-space-indented key (next service) or end of services block.
  const lines = content.split('\n');
  const out = [];
  let inRealtime = false;

  for (const line of lines) {
    if (!inRealtime && /^  realtime:\s*$/.test(line)) {
      inRealtime = true;
      out.push(`# [disabled for Phase 2, re-enable in Phase 4]`);
      out.push(`# ${line}`);
      continue;
    }
    if (inRealtime) {
      // Still inside realtime block: lines are either blank or indented > 2 spaces
      if (line === '' || /^    /.test(line) || /^      /.test(line) || /^  [^ ]/.test(line) === false) {
        if (/^  [a-zA-Z]/.test(line)) {
          // Next top-level service — end of realtime
          inRealtime = false;
          out.push(line);
        } else {
          out.push(`# ${line}`);
        }
      } else {
        inRealtime = false;
        out.push(line);
      }
      continue;
    }
    out.push(line);
  }

  await writeFile(composePath, out.join('\n'));
  console.log('  ✓ Realtime service block commented out');
}

const ENV_TEMPLATE = `# =============================================================================
# SynthCamp Supabase self-host env vars — REFERENCE / CHECKLIST
# =============================================================================
# In Railway deployment, paste these into the Supabase service Variables UI.
# You do NOT need to create a .env file locally unless you run Supabase via
# \`docker compose up\` on your own machine for development.
#
# Generate the *_KEY, JWT_SECRET, PASSWORD values via:
#   node scripts/generate-jwt-secrets.mjs
# =============================================================================

# --- Postgres ---
POSTGRES_PASSWORD=                # from generate-jwt-secrets.mjs
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# --- JWT (auth tokens) ---
JWT_SECRET=                       # from generate-jwt-secrets.mjs (HS256 secret)
JWT_EXPIRY=3600
ANON_KEY=                         # from generate-jwt-secrets.mjs (anon role JWT)
SERVICE_ROLE_KEY=                 # from generate-jwt-secrets.mjs (service_role JWT)

# --- Public URLs (fill after Railway deploy generates public domain) ---
SITE_URL=http://localhost:3000                                   # Next.js app URL
API_EXTERNAL_URL=https://YOUR-SUPABASE-URL.up.railway.app        # Supabase public URL
SUPABASE_PUBLIC_URL=https://YOUR-SUPABASE-URL.up.railway.app     # Same
ADDITIONAL_REDIRECT_URLS=

# --- Studio (admin UI) ---
STUDIO_DEFAULT_ORGANIZATION=SynthCamp
STUDIO_DEFAULT_PROJECT=SynthCamp
DASHBOARD_USERNAME=admin          # from generate-jwt-secrets.mjs
DASHBOARD_PASSWORD=               # from generate-jwt-secrets.mjs

# --- Auth (GoTrue) ---
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# --- SMTP (Brevo) ---
SMTP_ADMIN_EMAIL=noreply@synthcamp.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=                        # your Brevo login email
SMTP_PASS=                        # your Brevo SMTP API key (starts with xkeysib-)
SMTP_SENDER_NAME=SynthCamp

# --- Google OAuth ---
ENABLE_EMAIL_CHANGE_CONFIRMATIONS=true
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=
GOTRUE_EXTERNAL_GOOGLE_SECRET=
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://YOUR-SUPABASE-URL.up.railway.app/auth/v1/callback

# --- API (PostgREST) ---
PGRST_DB_SCHEMAS=public,storage,graphql_public

# --- Kong gateway ---
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# --- Storage ---
IMGPROXY_ENABLE_WEBP_DETECTION=true

# --- Pooler (Supavisor, for connection pooling) ---
POOLER_TENANT_ID=synthcamp
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_POOL_MODE=transaction

# --- Functions (Edge Functions, not used in Phase 2) ---
FUNCTIONS_VERIFY_JWT=false

# --- Analytics (not essential for Phase 2) ---
LOGFLARE_PUBLIC_ACCESS_TOKEN=
LOGFLARE_PRIVATE_ACCESS_TOKEN=

# --- Docker socket (for analytics; skip on Railway) ---
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
`;

async function main() {
  console.log(`→ Downloading Supabase docker-compose (release ${SUPABASE_RELEASE})`);
  await mkdir(SUPABASE_DIR, { recursive: true });

  await download(`${BASE_URL}/docker-compose.yml`, join(SUPABASE_DIR, 'docker-compose.yml'));
  console.log('  ✓ docker-compose.yml');

  console.log('→ Downloading Kong gateway config');
  await mkdir(join(SUPABASE_DIR, 'volumes/api'), { recursive: true });
  await download(`${BASE_URL}/volumes/api/kong.yml`, join(SUPABASE_DIR, 'volumes/api/kong.yml'));
  console.log('  ✓ volumes/api/kong.yml');

  console.log('→ Downloading DB init scripts');
  await mkdir(join(SUPABASE_DIR, 'volumes/db'), { recursive: true });
  const dbFiles = ['realtime.sql', 'webhooks.sql', 'roles.sql', 'jwt.sql', '_supabase.sql', 'logs.sql', 'pooler.sql'];
  for (const f of dbFiles) {
    const ok = await download(`${BASE_URL}/volumes/db/${f}`, join(SUPABASE_DIR, 'volumes/db', f), { optional: true });
    if (ok) console.log(`  ✓ volumes/db/${f}`);
  }

  console.log('→ Patching docker-compose (disable Realtime for Phase 2)');
  await patchRealtimeOut();

  console.log('→ Writing .env.example (reference / checklist)');
  await writeFile(join(SUPABASE_DIR, '.env.example'), ENV_TEMPLATE);
  console.log('  ✓ supabase-selfhost/.env.example');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' ✓ Setup complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(' Next steps:');
  console.log('   1. Run: node scripts/generate-jwt-secrets.mjs');
  console.log('      → copy output to password manager');
  console.log('   2. Deploy on Railway (see supabase-selfhost/README.md § 4)');
  console.log('      → paste env values directly into Railway Variables UI');
  console.log('   3. supabase-selfhost/.env.example is just a reference — no');
  console.log('      need to create a local .env unless you run docker-compose');
  console.log('      locally for development.');
  console.log('');
}

main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
