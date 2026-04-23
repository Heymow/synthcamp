#!/usr/bin/env bash
# SynthCamp — apply every SQL file in supabase/migrations in order, through
# the running supabase-db container. Idempotent (migrations use IF NOT
# EXISTS / CREATE OR REPLACE / DO blocks), so rerunning is safe.
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

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo -e "${YELLOW}No migrations found in $MIGRATIONS_DIR${NC}"
  exit 0
fi

echo -e "${BLUE}Applying ${#files[@]} migrations${NC}"
for f in "${files[@]}"; do
  name=$(basename "$f")
  printf '  %s ... ' "$name"
  if docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" > /tmp/synthcamp-migration.log 2>&1; then
    echo -e "${GREEN}ok${NC}"
  else
    echo -e "${RED}FAILED${NC}"
    cat /tmp/synthcamp-migration.log
    exit 1
  fi
done

echo -e "\n${GREEN}✓ All migrations applied${NC}"
