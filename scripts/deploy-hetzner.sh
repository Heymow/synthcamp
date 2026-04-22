#!/usr/bin/env bash
# =============================================================================
# SynthCamp — Full automated deploy of Supabase + Caddy on Hetzner VPS
# Target: Ubuntu 24.04 LTS, fresh server, root access
#
# Usage (on the Hetzner server, after SSH login as root):
#   bash <(curl -fsSL https://raw.githubusercontent.com/Heymow/synthcamp/main/scripts/deploy-hetzner.sh)
#
# Or after git clone:
#   sudo bash /opt/synthcamp/scripts/deploy-hetzner.sh
#
# What it does:
#   1. System hardening (ufw, fail2ban, updates)
#   2. Installs Docker + Compose plugin + Node 22 + Caddy + git
#   3. Clones synthcamp repo to /opt/synthcamp
#   4. Generates JWT secrets (saves to /root/synthcamp-secrets.txt)
#   5. Interactive prompts: Supabase domain, Next app URL, Brevo creds, Google OAuth
#   6. Writes supabase-selfhost/.env
#   7. docker compose up -d
#   8. Configures Caddy reverse proxy with auto-HTTPS
#   9. Smoke test + prints next steps
#
# Idempotent: safe to re-run (skips already-installed steps).
# =============================================================================

set -euo pipefail

REPO_URL="https://github.com/Heymow/synthcamp.git"
INSTALL_DIR="/opt/synthcamp"
SECRETS_FILE="/root/synthcamp-secrets.txt"

# ----- Colors and helpers ----------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}→${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${BLUE}━━━ $* ━━━${NC}"; }

prompt() {
  local var_name="$1"
  local message="$2"
  local secret="${3:-false}"
  local value=""
  while [[ -z "$value" ]]; do
    if [[ "$secret" == "true" ]]; then
      read -rsp "  $message: " value
      echo
    else
      read -rp "  $message: " value
    fi
    if [[ -z "$value" ]]; then
      warn "Cannot be empty, try again."
    fi
  done
  printf -v "$var_name" "%s" "$value"
}

# ----- Preflight -------------------------------------------------------------

preflight() {
  step "Preflight checks"

  if [[ $EUID -ne 0 ]]; then
    error "This script must run as root (use sudo or login as root)"
    exit 1
  fi

  if ! command -v lsb_release >/dev/null 2>&1; then
    apt install -y lsb-release >/dev/null 2>&1 || true
  fi

  local os_desc
  os_desc=$(lsb_release -d 2>/dev/null | cut -f2 || echo "unknown")
  success "Running as root on $os_desc"

  if ! echo "$os_desc" | grep -q "Ubuntu 24"; then
    warn "Not on Ubuntu 24.x — continuing but compatibility not guaranteed"
  fi
}

# ----- System hardening ------------------------------------------------------

system_hardening() {
  step "System update and hardening"

  info "Updating apt packages"
  apt update -qq
  DEBIAN_FRONTEND=noninteractive apt upgrade -y -qq
  success "System updated"

  info "Installing base tools (ufw, fail2ban, git, curl, nano)"
  apt install -y -qq ca-certificates curl gnupg git nano ufw fail2ban
  success "Base tools installed"

  info "Configuring UFW firewall"
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  success "UFW firewall: 22, 80, 443 open"

  info "Enabling fail2ban"
  systemctl enable --now fail2ban >/dev/null
  success "fail2ban active"
}

# ----- Docker ----------------------------------------------------------------

install_docker() {
  step "Docker installation"

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    success "Docker + Compose already installed ($(docker --version))"
    return
  fi

  info "Adding Docker apt repository"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  chmod a+r /etc/apt/keyrings/docker.gpg
  local codename
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $codename stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null

  info "Installing Docker Engine + Compose plugin"
  apt update -qq
  apt install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  success "Docker $(docker --version | cut -d',' -f1) + Compose installed"
}

# ----- Node 22 ---------------------------------------------------------------

install_node() {
  step "Node.js 22 installation"

  if command -v node >/dev/null 2>&1; then
    local v
    v=$(node --version | tr -d 'v' | cut -d. -f1)
    if [[ "$v" -ge 22 ]]; then
      success "Node $(node --version) already installed"
      return
    fi
  fi

  info "Installing Node 22 from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt install -y -qq nodejs
  success "Node $(node --version) installed"
}

# ----- Caddy -----------------------------------------------------------------

install_caddy() {
  step "Caddy installation"

  if command -v caddy >/dev/null 2>&1; then
    success "Caddy already installed ($(caddy version | head -1))"
    return
  fi

  info "Adding Caddy apt repository"
  apt install -y -qq debian-keyring debian-archive-keyring apt-transport-https

  # Clean up any prior broken attempts
  rm -f /etc/apt/trusted.gpg.d/caddy-stable.asc \
        /etc/apt/sources.list.d/caddy-stable.list \
        /usr/share/keyrings/caddy-stable-archive-keyring.gpg

  # Use official install pattern from caddyserver.com/docs/install :
  # dearmor the ASCII key into a binary keyring in /usr/share/keyrings/
  # then add the sources list which includes a signed-by= pointer to that keyring.
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

  info "Installing Caddy"
  apt update -qq
  apt install -y -qq caddy
  success "Caddy $(caddy version | head -1 | cut -d' ' -f1) installed"
}

# ----- Repo clone ------------------------------------------------------------

clone_repo() {
  step "Cloning synthcamp repo"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Repo already cloned, pulling latest"
    git -C "$INSTALL_DIR" pull --ff-only
    success "Repo up to date"
    return
  fi

  info "Cloning $REPO_URL to $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  success "Repo cloned"
}

# ----- JWT secrets generation ------------------------------------------------

generate_secrets() {
  step "Generating JWT secrets"

  if [[ -f "$SECRETS_FILE" ]]; then
    warn "Secrets file already exists at $SECRETS_FILE — reusing"
    return
  fi

  info "Running generate-jwt-secrets.mjs"
  node "$INSTALL_DIR/scripts/generate-jwt-secrets.mjs" --env > "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
  success "Secrets saved to $SECRETS_FILE (mode 600, root-only)"

  echo
  warn "⚠  Display secrets now to save in password manager ? [y/N]"
  read -rp "  > " show
  if [[ "${show,,}" == "y" ]]; then
    echo
    cat "$SECRETS_FILE"
    echo
    echo "Press Enter to continue (make sure you saved these!)"
    read
  fi
}

# ----- Download Supabase docker-compose --------------------------------------

download_supabase() {
  step "Downloading Supabase docker-compose"

  cd "$INSTALL_DIR"
  node scripts/setup-supabase.mjs
  success "Supabase config scaffolded"
}

# ----- Interactive configuration prompts -------------------------------------

collect_user_input() {
  step "Configuration prompts"

  echo "  Please provide the following values (from your password manager):"
  echo

  prompt DOMAIN_API "Supabase API domain (e.g., api.synthcamp.net)"
  prompt DOMAIN_APP "Next.js app URL (e.g., https://synthcamp.net)"
  prompt ADMIN_EMAIL "Admin email for SMTP sender (e.g., noreply@synthcamp.net)"
  prompt BREVO_USER "Brevo SMTP username (your Brevo login email)"
  prompt BREVO_PASS "Brevo SMTP password (API key starting with xkeysib-)" true
  prompt GOOGLE_CID "Google OAuth Client ID"
  prompt GOOGLE_SEC "Google OAuth Client Secret" true

  success "All values collected"
}

# ----- Write .env ------------------------------------------------------------

write_env_file() {
  step "Writing supabase-selfhost/.env"

  local env_file="$INSTALL_DIR/supabase-selfhost/.env"

  # Source the secrets file (provides POSTGRES_PASSWORD, JWT_SECRET, etc.)
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"

  cat > "$env_file" <<EOF
# =============================================================================
# Generated by scripts/deploy-hetzner.sh on $(date -Is)
# =============================================================================

# --- Postgres ---
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# --- JWT ---
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=3600
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# --- Public URLs ---
SITE_URL=$DOMAIN_APP
API_EXTERNAL_URL=https://$DOMAIN_API
SUPABASE_PUBLIC_URL=https://$DOMAIN_API
ADDITIONAL_REDIRECT_URLS=

# --- Studio ---
STUDIO_DEFAULT_ORGANIZATION=SynthCamp
STUDIO_DEFAULT_PROJECT=SynthCamp
DASHBOARD_USERNAME=$DASHBOARD_USERNAME
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

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

# --- SMTP Brevo ---
SMTP_ADMIN_EMAIL=$ADMIN_EMAIL
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=$BREVO_USER
SMTP_PASS=$BREVO_PASS
SMTP_SENDER_NAME=SynthCamp

# --- Google OAuth ---
ENABLE_EMAIL_CHANGE_CONFIRMATIONS=true
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=$GOOGLE_CID
GOTRUE_EXTERNAL_GOOGLE_SECRET=$GOOGLE_SEC
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://$DOMAIN_API/auth/v1/callback

# --- API (PostgREST) ---
PGRST_DB_SCHEMAS=public,storage,graphql_public

# --- Kong ---
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# --- Storage ---
IMGPROXY_ENABLE_WEBP_DETECTION=true

# --- Pooler ---
POOLER_TENANT_ID=synthcamp
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_POOL_MODE=transaction

# --- Functions (not used Phase 2) ---
FUNCTIONS_VERIFY_JWT=false

# --- Analytics (optional) ---
LOGFLARE_PUBLIC_ACCESS_TOKEN=
LOGFLARE_PRIVATE_ACCESS_TOKEN=
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
EOF

  chmod 600 "$env_file"
  success ".env written with all values (mode 600)"
}

# ----- Start Supabase stack --------------------------------------------------

start_stack() {
  step "Starting Supabase stack"

  cd "$INSTALL_DIR/supabase-selfhost"
  info "Pulling images (this can take 5-10 minutes)"
  docker compose pull
  info "Starting containers"
  docker compose up -d

  info "Waiting for services to become healthy (60s)"
  sleep 60

  echo
  info "Container status:"
  docker compose ps

  echo
  info "Quick local test:"
  if curl -sf http://localhost:8000/auth/v1/health >/dev/null; then
    success "GoTrue responding locally on port 8000"
  else
    warn "GoTrue not yet responding — may still be starting. Check: docker compose logs auth"
  fi
}

# ----- Configure Caddy -------------------------------------------------------

configure_caddy() {
  step "Configuring Caddy reverse proxy for $DOMAIN_API"

  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN_API {
    reverse_proxy localhost:8000

    header {
        -Server
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    log {
        output file /var/log/caddy/$DOMAIN_API.log
        format json
    }
}
EOF

  mkdir -p /var/log/caddy
  chown caddy:caddy /var/log/caddy 2>/dev/null || true

  if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    success "Caddyfile valid"
  else
    error "Caddyfile validation failed"
    caddy validate --config /etc/caddy/Caddyfile || true
    return 1
  fi

  systemctl restart caddy
  systemctl enable --now caddy >/dev/null 2>&1 || true
  sleep 3

  if systemctl is-active --quiet caddy; then
    success "Caddy running"
  else
    error "Caddy failed to start — check: journalctl -u caddy"
    return 1
  fi
}

# ----- Smoke test ------------------------------------------------------------

smoke_test() {
  step "Smoke test"

  local server_ip
  server_ip=$(curl -fsSL https://api.ipify.org 2>/dev/null || echo "unknown")

  info "Server public IP: $server_ip"
  info "Domain configured: $DOMAIN_API"

  local domain_ip
  domain_ip=$(dig +short "$DOMAIN_API" @8.8.8.8 2>/dev/null | head -1 || echo "")

  if [[ -z "$domain_ip" ]]; then
    warn "DNS for $DOMAIN_API not resolving yet"
    warn "   Configure your DNS (A record pointing to $server_ip) and wait for propagation"
    warn "   Then Caddy will obtain SSL cert automatically on first HTTPS request"
  elif [[ "$domain_ip" == "$server_ip" ]]; then
    success "DNS resolves $DOMAIN_API → $domain_ip (matches server)"
    info "Testing HTTPS endpoint..."
    if curl -sf "https://$DOMAIN_API/auth/v1/health" >/dev/null 2>&1; then
      success "🎉 https://$DOMAIN_API/auth/v1/health is alive!"
    else
      warn "HTTPS endpoint not responding yet — Caddy may still be fetching SSL cert"
      warn "   Try again in 1-2 minutes: curl https://$DOMAIN_API/auth/v1/health"
    fi
  else
    warn "DNS for $DOMAIN_API resolves to $domain_ip, but server is $server_ip"
    warn "   Update DNS to point to $server_ip then wait for propagation"
  fi
}

# ----- Final instructions ----------------------------------------------------

print_next_steps() {
  step "🎉 Setup complete"

  # shellcheck disable=SC1090
  source "$SECRETS_FILE"

  cat <<EOF

${BOLD}Stack deployed.${NC} Next steps (on your local Windows machine):

${BLUE}1.${NC} Ensure DNS is configured — at your domain registrar, add:
   ${BOLD}A record:${NC}    $DOMAIN_API → $(curl -fsSL https://api.ipify.org 2>/dev/null || echo '<this-server-ip>')

${BLUE}2.${NC} Wait for DNS propagation (~5-15 min), then test:
   ${BOLD}curl https://$DOMAIN_API/auth/v1/health${NC}

${BLUE}3.${NC} Add this Supabase URL to Google OAuth Console → Authorized redirect URIs:
   ${BOLD}https://$DOMAIN_API/auth/v1/callback${NC}

${BLUE}4.${NC} In your Next.js project on Railway, set these env vars:
   ${BOLD}NEXT_PUBLIC_SUPABASE_URL${NC}=https://$DOMAIN_API
   ${BOLD}NEXT_PUBLIC_SUPABASE_ANON_KEY${NC}=$ANON_KEY
   ${BOLD}SUPABASE_SERVICE_ROLE_KEY${NC}=$SERVICE_ROLE_KEY

${BLUE}5.${NC} Optional — access Supabase Studio via SSH tunnel:
   ${BOLD}ssh -L 3000:localhost:3000 root@$(curl -fsSL https://api.ipify.org 2>/dev/null || echo '<server-ip>')${NC}
   Then open http://localhost:3000 in your browser
   Login: ${BOLD}$DASHBOARD_USERNAME${NC} / ${BOLD}$DASHBOARD_PASSWORD${NC}

${YELLOW}⚠  Secrets file:${NC} $SECRETS_FILE (mode 600, root-only)
${YELLOW}   Delete it once you've saved everything in your password manager:${NC}
   ${BOLD}shred -u $SECRETS_FILE${NC}

${GREEN}All green. Go build the marketplace.${NC}

EOF
}

# ----- Main ------------------------------------------------------------------

main() {
  preflight
  system_hardening
  install_docker
  install_node
  install_caddy
  clone_repo
  generate_secrets
  download_supabase
  collect_user_input
  write_env_file
  start_stack
  configure_caddy
  smoke_test
  print_next_steps
}

main "$@"
