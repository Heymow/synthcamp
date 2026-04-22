#!/usr/bin/env bash
# Downloads the official Supabase docker-compose config and patches it for SynthCamp (no Realtime).
# Usage: bash supabase-selfhost/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Pin to a tested Supabase release
SUPABASE_RELEASE="2026.01.15"
BASE_URL="https://raw.githubusercontent.com/supabase/supabase/${SUPABASE_RELEASE}/docker"

echo "→ Downloading Supabase docker-compose (release ${SUPABASE_RELEASE})"
curl -fsSL "${BASE_URL}/docker-compose.yml" -o docker-compose.yml
curl -fsSL "${BASE_URL}/.env.example" -o .env.example.supabase-original

echo "→ Downloading Kong gateway config"
mkdir -p volumes/api
curl -fsSL "${BASE_URL}/volumes/api/kong.yml" -o volumes/api/kong.yml

echo "→ Downloading db init scripts"
mkdir -p volumes/db
for f in realtime.sql webhooks.sql roles.sql jwt.sql _supabase.sql logs.sql pooler.sql; do
  curl -fsSL "${BASE_URL}/volumes/db/${f}" -o "volumes/db/${f}" 2>/dev/null || true
done

echo "→ Patching docker-compose to disable Realtime (Phase 4 feature)"
# Comment out the entire realtime service block (portable sed)
if command -v python3 >/dev/null 2>&1; then
  python3 <<'PYEOF'
import re
with open('docker-compose.yml', 'r') as f:
    content = f.read()
# Comment out the realtime service block
pattern = re.compile(r'^(  realtime:\n(?:    .+\n|    \n)+)', re.MULTILINE)
def comment_block(m):
    return '\n'.join('  # ' + line[2:] if line.startswith('  ') else '# ' + line for line in m.group(1).split('\n'))
new_content = pattern.sub(comment_block, content)
with open('docker-compose.yml', 'w') as f:
    f.write(new_content)
print("  ✓ Realtime service block commented out")
PYEOF
else
  echo "  ⚠  python3 not available, Realtime service NOT commented automatically."
  echo "     Edit docker-compose.yml manually and remove/comment the 'realtime:' block."
fi

echo "→ Merging SynthCamp env template with Supabase defaults"
cat > .env.example <<'EOF'
# =============================================================================
# SynthCamp Supabase self-host env vars
# Run `node ../scripts/generate-jwt-secrets.mjs` from project root to generate
# the secrets below, then fill in Brevo + Google OAuth creds manually.
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

# --- Public URLs (fill after Railway deploy) ---
SITE_URL=http://localhost:3000                                   # Next.js app URL
API_EXTERNAL_URL=https://YOUR-SUPABASE-URL.up.railway.app        # Supabase public URL
SUPABASE_PUBLIC_URL=https://YOUR-SUPABASE-URL.up.railway.app     # Same as above
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

# Magic link email template (used by GoTrue)
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# --- SMTP (Brevo) ---
SMTP_ADMIN_EMAIL=noreply@synthcamp.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=                        # your Brevo login email
SMTP_PASS=                        # your Brevo SMTP API key
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

# --- Analytics (logflare, not essential for Phase 2) ---
LOGFLARE_PUBLIC_ACCESS_TOKEN=
LOGFLARE_PRIVATE_ACCESS_TOKEN=

# --- Docker socket (for analytics) ---
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
EOF

echo "→ Cleaning up Supabase's original .env.example"
rm -f .env.example.supabase-original

echo ""
echo "✓ Setup complete."
echo ""
echo "Next steps:"
echo "  1. From project root: node scripts/generate-jwt-secrets.mjs"
echo "  2. cp supabase-selfhost/.env.example supabase-selfhost/.env"
echo "  3. Edit .env and paste the generated values + Brevo + Google creds"
echo "  4. Follow supabase-selfhost/README.md step 4 to deploy on Railway"
