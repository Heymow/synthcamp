#!/usr/bin/env bash
# SynthCamp — Auth diagnostic + auto-fix
#
# Runs on the VPS from /opt/synthcamp. Diagnoses why GoTrue is rejecting
# Google OAuth and SMTP, applies the docker-compose.override.yml, recreates
# the auth container, and shows before/after state.
#
# Usage (from /opt/synthcamp):
#   bash scripts/diagnose-auth.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="/opt/synthcamp"
SUPABASE_DIR="$PROJECT_DIR/supabase-selfhost"

step() { echo -e "\n${BOLD}${BLUE}━━━ $* ━━━${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

cd "$SUPABASE_DIR"

step "1. Env vars currently in the running auth container (BEFORE fix)"
if docker ps --format '{{.Names}}' | grep -q '^supabase-auth$'; then
  docker exec supabase-auth env 2>/dev/null \
    | grep -iE 'google|smtp|site_url|api_external|mailer' \
    | sort \
    || warn "No matching env vars in container."
else
  err "supabase-auth container is not running."
fi

step "2. Relevant .env values (secrets masked)"
if [[ -f .env ]]; then
  grep -E '^(GOTRUE_EXTERNAL_GOOGLE_|SMTP_|SITE_URL|API_EXTERNAL_URL|ADDITIONAL_REDIRECT_URLS|ENABLE_EMAIL|DISABLE_SIGNUP|MAILER_URLPATHS_)' .env \
    | sed -E 's/(SECRET|PASS)=.*/\1=***MASKED***/g' \
    || warn "No matching .env vars."
else
  err ".env missing at $SUPABASE_DIR/.env"
  exit 1
fi

step "3. Verify override.yml is in place"
if [[ -f docker-compose.override.yml ]]; then
  ok "docker-compose.override.yml found"
else
  err "docker-compose.override.yml missing — did you run 'git pull' from $PROJECT_DIR first?"
  exit 1
fi

step "4. Force-recreate auth container (picks up override + latest .env)"
docker compose up -d --force-recreate auth
echo "Waiting for auth to become healthy..."
sleep 8

step "5. Env vars in auth container (AFTER fix)"
docker exec supabase-auth env 2>/dev/null \
  | grep -iE 'google|smtp|site_url|api_external|mailer' \
  | sort

step "6. Health check"
if curl -sf http://localhost:8000/auth/v1/health -o /dev/null; then
  ok "GoTrue responds on /auth/v1/health"
else
  err "GoTrue not responding (check docker compose logs auth)"
fi

step "7. GoTrue public settings (shows enabled providers)"
ANON_KEY=$(grep '^ANON_KEY=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [[ -z "$ANON_KEY" ]]; then
  warn "ANON_KEY not found in .env — skipping /settings check"
else
  SETTINGS=$(curl -s "http://localhost:8000/auth/v1/settings" -H "apikey: $ANON_KEY")
  if [[ -z "$SETTINGS" ]]; then
    warn "No response from /settings"
  else
    echo "$SETTINGS" | python3 -m json.tool 2>/dev/null || echo "$SETTINGS"
  fi
fi

step "8. Last 20 auth log lines"
docker compose logs auth --tail 20

echo ""
echo -e "${BOLD}${GREEN}━━━ Diagnostic complete ━━━${NC}"
echo ""
echo -e "${BOLD}Interpretation guide:${NC}"
echo ""
echo "  • Section 5 should now show GOTRUE_EXTERNAL_GOOGLE_ENABLED=true"
echo "    and GOTRUE_SMTP_HOST=smtp-relay.brevo.com."
echo "    If those are MISSING, the override isn't being picked up — check"
echo "    that the override file is in $SUPABASE_DIR/ (same dir as docker-compose.yml)."
echo ""
echo "  • Section 7 JSON should include a 'external' object listing 'google' as"
echo "    enabled. If it's missing, the OAuth env vars didn't stick."
echo ""
echo "  • Next step: open https://synthcamp.net/auth/login in your browser."
echo "    Google OAuth + magic link should both work. If not, follow live logs:"
echo "      docker compose logs auth -f"
echo ""
