#!/usr/bin/env bash
# SynthCamp — apply pending SQL migrations via the supabase-db container,
# tracking applied ones in a `_synthcamp_migrations` table so reruns skip
# what's already in place.
#
# Usage (from /opt/synthcamp on the VPS):
#   bash scripts/apply-migrations.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="/opt/synthcamp"
MIGRATIONS_DIR="$ROOT/supabase/migrations"

cd "$ROOT"

if ! docker ps --format '{{.Names}}' | grep -q '^supabase-db$'; then
  echo -e "${RED}✗ supabase-db container is not running${NC}"
  exit 1
fi

run_sql() {
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

# Bootstrap the tracking table.
run_sql -c "CREATE TABLE IF NOT EXISTS public._synthcamp_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);" > /dev/null

# Seed tracking for the original phase-2 migrations if the schema looks
# already-migrated (profiles + releases + tracks tables exist) but the
# tracking table is empty. This avoids trying to reapply them.
APPLIED_COUNT=$(run_sql -tA -c "SELECT count(*) FROM public._synthcamp_migrations;")
if [[ "$APPLIED_COUNT" == "0" ]]; then
  HAS_CORE=$(run_sql -tA -c "SELECT
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='releases')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tracks');
  ")
  if [[ "$HAS_CORE" == "t" ]]; then
    echo -e "${YELLOW}Core tables already exist; marking 20260422* migrations as applied.${NC}"
    for f in "$MIGRATIONS_DIR"/20260422*.sql; do
      [[ -f "$f" ]] || continue
      name=$(basename "$f")
      run_sql -c "INSERT INTO public._synthcamp_migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING;" > /dev/null
    done
  fi
fi

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo -e "${YELLOW}No migrations found in $MIGRATIONS_DIR${NC}"
  exit 0
fi

applied=0
skipped=0
for f in "${files[@]}"; do
  name=$(basename "$f")
  IS_APPLIED=$(run_sql -tA -c "SELECT EXISTS (SELECT 1 FROM public._synthcamp_migrations WHERE filename='$name');")
  if [[ "$IS_APPLIED" == "t" ]]; then
    skipped=$((skipped + 1))
    continue
  fi
  printf '  %s ... ' "$name"
  if run_sql < "$f" > /tmp/synthcamp-migration.log 2>&1; then
    run_sql -c "INSERT INTO public._synthcamp_migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING;" > /dev/null
    echo -e "${GREEN}ok${NC}"
    applied=$((applied + 1))
  else
    echo -e "${RED}FAILED${NC}"
    cat /tmp/synthcamp-migration.log
    exit 1
  fi
done

echo -e "\n${GREEN}✓ Done${NC} — ${applied} applied, ${skipped} already in place"
