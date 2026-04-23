#!/usr/bin/env bash
# SynthCamp — post-migration smoke test. Confirms all schema objects exist
# in the DB and that key public endpoints respond with 200.
#
# Usage (from /opt/synthcamp on the VPS):
#   bash scripts/verify-deploy.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

BASE="${BASE_URL:-https://synthcamp.net}"

step() { echo -e "\n${BOLD}${BLUE}━━━ $* ━━━${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
bad()  { echo -e "  ${RED}✗${NC} $*"; }

FAILURES=0

step "Database schema"
QUERY=$(cat <<'SQL'
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='follows') AS has_follows,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') AS has_notifications,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reports') AS has_reports,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='preview_url') AS has_preview_url,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='plays_count') AS has_plays_count,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_account_id') AS has_stripe_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='payout_enabled') AS has_payout_enabled,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='increment_track_play') AS has_increment_play,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='fanout_release_notification') AS has_fanout,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='popular_genres') AS has_popular_genres,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') AS has_trgm,
  EXISTS (SELECT 1 FROM pg_type WHERE typname='report_target_type') AS has_report_enum,
  EXISTS (SELECT 1 FROM pg_type WHERE typname='notification_kind') AS has_notif_enum;
SQL
)

if ! docker ps --format '{{.Names}}' | grep -q '^supabase-db$'; then
  bad "supabase-db container not running"
  FAILURES=$((FAILURES + 1))
else
  RESULT=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -F',' -c "$QUERY" 2>&1 || echo "ERROR")
  if [[ "$RESULT" == *ERROR* ]]; then
    bad "DB query failed: $RESULT"
    FAILURES=$((FAILURES + 1))
  else
    IFS=',' read -r f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12 f13 <<< "$RESULT"
    [[ "$f1"  == "t" ]] && ok "follows table"           || { bad "follows table missing";           FAILURES=$((FAILURES+1)); }
    [[ "$f2"  == "t" ]] && ok "notifications table"     || { bad "notifications table missing";     FAILURES=$((FAILURES+1)); }
    [[ "$f3"  == "t" ]] && ok "reports table"           || { bad "reports table missing";           FAILURES=$((FAILURES+1)); }
    [[ "$f4"  == "t" ]] && ok "tracks.preview_url"      || { bad "tracks.preview_url missing";      FAILURES=$((FAILURES+1)); }
    [[ "$f5"  == "t" ]] && ok "tracks.plays_count"      || { bad "tracks.plays_count missing";      FAILURES=$((FAILURES+1)); }
    [[ "$f6"  == "t" ]] && ok "profiles.stripe_account_id" || { bad "profiles.stripe_account_id missing"; FAILURES=$((FAILURES+1)); }
    [[ "$f7"  == "t" ]] && ok "profiles.payout_enabled" || { bad "profiles.payout_enabled missing"; FAILURES=$((FAILURES+1)); }
    [[ "$f8"  == "t" ]] && ok "increment_track_play RPC" || { bad "increment_track_play RPC missing"; FAILURES=$((FAILURES+1)); }
    [[ "$f9"  == "t" ]] && ok "fanout_release_notification RPC" || { bad "fanout_release_notification RPC missing"; FAILURES=$((FAILURES+1)); }
    [[ "$f10" == "t" ]] && ok "popular_genres RPC"      || { bad "popular_genres RPC missing";      FAILURES=$((FAILURES+1)); }
    [[ "$f11" == "t" ]] && ok "pg_trgm extension"       || { bad "pg_trgm extension missing";       FAILURES=$((FAILURES+1)); }
    [[ "$f12" == "t" ]] && ok "report_target_type enum" || { bad "report_target_type enum missing"; FAILURES=$((FAILURES+1)); }
    [[ "$f13" == "t" ]] && ok "notification_kind enum"  || { bad "notification_kind enum missing";  FAILURES=$((FAILURES+1)); }
  fi
fi

step "Public endpoints (expect 200)"
check_url() {
  local path="$1"
  local url="${BASE}${path}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    ok "$path → 200"
  else
    bad "$path → $code"
    FAILURES=$((FAILURES + 1))
  fi
}

check_url "/"
check_url "/explore/home"
check_url "/explore/search"
check_url "/explore/library"
check_url "/auth/login"

echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}━━━ Deploy verified (no failures) ━━━${NC}"
else
  echo -e "${BOLD}${RED}━━━ $FAILURES failures — see above ━━━${NC}"
  exit 1
fi
