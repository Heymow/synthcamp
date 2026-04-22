# Déploiement Supabase self-host sur VPS Hetzner

Guide pas-à-pas pour déployer le stack Supabase sur un petit VPS Hetzner avec Caddy en reverse proxy (SSL automatique).

**Temps estimé :** 1-2 h pour un premier déploiement.
**Coût :** ~4,51 €/mo pour CX22.

## Prérequis

- Compte Hetzner Cloud (https://console.hetzner.cloud)
- Clé SSH générée localement (voir étape 0 si besoin)
- DNS de `synthcamp.net` géré quelque part (OVH, Cloudflare, Namecheap, etc.)

## Étape 0 — Générer une clé SSH si tu n'en as pas

Sur ta machine locale Windows (PowerShell) :

```powershell
ssh-keygen -t ed25519 -C "hemo@synthcamp"
# Appuie sur Enter pour sauver dans l'emplacement par défaut (~/.ssh/id_ed25519)
# Mets une passphrase forte (optionnel mais recommandé)
```

Récupère la clé publique :

```powershell
cat ~/.ssh/id_ed25519.pub
# Copie toute la ligne qui commence par "ssh-ed25519 ..."
```

## Étape 1 — Créer le serveur Hetzner

1. Connecte-toi à https://console.hetzner.cloud
2. **Projects** → create (ou utilise existing) → **Add Server**
3. **Location** : Falkenstein FSN1 ou Helsinki HEL1 (EU, latence basse)
4. **Image** : Ubuntu 24.04
5. **Type** : **CX22** (2 vCPU, 4 GB RAM, 40 GB SSD, 4,51 €/mo). Le CX11 suffit techniquement mais CX22 a plus de marge pour 8+ containers.
6. **Networking** : IPv4 + IPv6 (inclus gratuits).
7. **SSH Keys** : Add SSH Key → colle ta clé publique, donne-lui un nom.
8. **Volumes** : skip (40 GB SSD inclus suffit).
9. **Firewall** : applique un firewall qui ouvre ports 22 (SSH), 80 (HTTP), 443 (HTTPS). Ne pas ouvrir d'autres ports.
10. **Name** : `synthcamp-supabase`
11. **Create & Buy now**.

Hetzner provisionne en ~30 s. Note l'**IPv4 publique** (format `95.217.xxx.xxx`).

## Étape 2 — SSH dans le serveur

```powershell
ssh root@<ton-ip-ipv4>
# Accepte la fingerprint au premier connect (yes)
```

Tu es root sur Ubuntu 24.04 fresh.

## Étape 3 — Sécuriser le serveur (hygiène de base)

```bash
# Mise à jour
apt update && apt upgrade -y

# Firewall logiciel (double layer avec Hetzner firewall)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Fail2ban basique pour limiter brute-force SSH
apt install -y fail2ban
systemctl enable --now fail2ban
```

## Étape 4 — Installer Docker + Docker Compose

```bash
# Deps
apt install -y ca-certificates curl gnupg

# Keyring Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Repo Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

## Étape 5 — Installer Node 22 (pour les scripts setup + JWT)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git
node --version   # Doit afficher v22.x
```

## Étape 6 — Cloner le repo SynthCamp

```bash
cd /opt
git clone https://github.com/Heymow/synthcamp.git
cd synthcamp
```

## Étape 7 — Générer les secrets Supabase

```bash
node scripts/generate-jwt-secrets.mjs > /tmp/supabase-secrets.txt
cat /tmp/supabase-secrets.txt
```

**COPIE** le contenu de `/tmp/supabase-secrets.txt` dans ton password manager immédiatement. Puis supprime le fichier :

```bash
shred -u /tmp/supabase-secrets.txt
```

## Étape 8 — Télécharger le docker-compose Supabase

```bash
node scripts/setup-supabase.mjs
```

Vérifie que `supabase-selfhost/docker-compose.yml` existe et fait ~20 KB.

## Étape 9 — Créer `.env`

```bash
cp supabase-selfhost/.env.example supabase-selfhost/.env
nano supabase-selfhost/.env
```

Dans nano, remplis **toutes** les valeurs :

```bash
# Depuis generate-jwt-secrets.mjs
POSTGRES_PASSWORD=xxxxx
JWT_SECRET=xxxxx
ANON_KEY=xxxxx
SERVICE_ROLE_KEY=xxxxx
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=xxxxx

# URLs (SITE_URL = Next.js URL, API_EXTERNAL_URL = api.synthcamp.net)
SITE_URL=https://synthcamp.net
API_EXTERNAL_URL=https://api.synthcamp.net
SUPABASE_PUBLIC_URL=https://api.synthcamp.net

# Brevo SMTP
SMTP_ADMIN_EMAIL=noreply@synthcamp.net
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=ton-email-brevo@example.com
SMTP_PASS=xkeysib-xxxxxxxx
SMTP_SENDER_NAME=SynthCamp

# Google OAuth
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=GOCSPX-xxxx
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.synthcamp.net/auth/v1/callback
```

Sauvegarde avec `Ctrl+O` puis `Enter`, sort avec `Ctrl+X`.

## Étape 10 — Démarrer le stack Supabase

```bash
cd supabase-selfhost
docker compose up -d
```

Attends ~1-2 min pour que tous les services boot. Vérifie :

```bash
docker compose ps
# Tous doivent être "Up" ou "Up (healthy)"
```

Check les logs si un crash :

```bash
docker compose logs db | tail -20
docker compose logs auth | tail -20
docker compose logs kong | tail -20
```

Test local (depuis le serveur) :

```bash
curl http://localhost:8000/auth/v1/health
# Doit renvoyer {"version":"...","name":"GoTrue",...}
```

## Étape 11 — Installer Caddy reverse proxy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | tee /etc/apt/trusted.gpg.d/caddy-stable.asc
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

## Étape 12 — Configurer Caddy

Édite `/etc/caddy/Caddyfile` :

```bash
nano /etc/caddy/Caddyfile
```

Remplace tout le contenu par :

```caddy
# Supabase API (Kong gateway)
api.synthcamp.net {
    reverse_proxy localhost:8000
    
    # Rate limiting basique pour éviter les abus
    header {
        -Server
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}
```

Sauvegarde. Teste la config :

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Recharge Caddy :

```bash
systemctl restart caddy
systemctl enable caddy
systemctl status caddy
```

## Étape 13 — Configurer DNS

Dans ton registrar de `synthcamp.net` (OVH, Cloudflare, ou autre) :

Ajoute un **A record** :
- Name : `api`
- Value : `<IPv4 de ton serveur Hetzner>`
- TTL : 300 (5 min)

Si ton registrar supporte IPv6, ajoute aussi un **AAAA record** :
- Name : `api`
- Value : `<IPv6 de ton serveur Hetzner>`

Attends la propagation DNS (~1-15 min). Vérifie depuis ta machine locale :

```powershell
nslookup api.synthcamp.net
# Doit renvoyer ton IP Hetzner
```

## Étape 14 — Vérifier HTTPS

Depuis ta machine locale :

```powershell
curl https://api.synthcamp.net/auth/v1/health
```

Doit renvoyer `{"version":"...","name":"GoTrue","description":"..."}`.

Caddy obtient automatiquement un certificat SSL Let's Encrypt dès la première requête HTTPS.

## Étape 15 — Ajouter le redirect URI Google OAuth

Retourne sur Google Cloud Console → OAuth 2.0 credentials → ton app → ajoute comme Authorized redirect URI :

```
https://api.synthcamp.net/auth/v1/callback
```

Sauvegarde.

## Étape 16 — Donner les keys au Next.js

Dans ton `.env.local` local (projet Windows) :

```
NEXT_PUBLIC_SUPABASE_URL=https://api.synthcamp.net
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY depuis secrets>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY depuis secrets>
```

Et sur Railway (pour la version déployée), Service Next.js → Variables, ajoute les 3 mêmes.

## Étape 17 — Accéder à Supabase Studio

Studio tourne sur le port interne 3000 du container. Pour y accéder :

**Option A** : SSH tunnel depuis ta machine locale

```powershell
ssh -L 3000:localhost:3000 root@<ip-serveur>
# Laisse la session ouverte, ouvre http://localhost:3000 dans ton navigateur
```

Login avec `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.

**Option B** : Expose Studio via Caddy (moins safe, à éviter en prod sans auth supplémentaire). Ajoute dans `/etc/caddy/Caddyfile` :

```caddy
studio.synthcamp.net {
    reverse_proxy localhost:3000
    
    basicauth {
        admin <bcrypt-hash-du-password>
    }
}
```

Génère un hash :

```bash
caddy hash-password --plaintext "<ton-dashboard-password>"
```

## Maintenance

### Voir les logs
```bash
cd /opt/synthcamp/supabase-selfhost
docker compose logs -f <service>
```

### Backup Postgres (quotidien via cron)
```bash
crontab -e
# Ajoute :
0 3 * * * docker exec supabase-db pg_dump -U postgres postgres > /backups/supabase-$(date +\%F).sql
```

Pense à exporter les backups hors du serveur (rsync vers R2, par exemple).

### Updates
```bash
cd /opt/synthcamp
git pull
node scripts/setup-supabase.mjs     # re-pull latest compose
cd supabase-selfhost
docker compose pull
docker compose up -d
```

### Monitoring de base
```bash
# État des containers
docker compose ps

# Usage CPU/RAM
docker stats --no-stream

# Espace disque
df -h
```

## Troubleshooting

**Service ne démarre pas :** `docker compose logs <service> | tail -100`

**SSL qui ne marche pas :** vérifier que DNS a propagé (`dig api.synthcamp.net`), que Caddy écoute sur 80/443 (`ss -tlnp`), que firewall ouvre ces ports (`ufw status`).

**Magic link emails pas reçus :** Brevo dashboard → Statistics → Sent — vérifier les logs d'envoi. Si Brevo rejette, vérifier que `SMTP_ADMIN_EMAIL` est bien sur un domaine vérifié dans Brevo (sinon mettre `noreply@` d'un domaine que tu contrôles).

**Google OAuth callback error :** vérifier que l'URL exacte `https://api.synthcamp.net/auth/v1/callback` est dans Authorized redirect URIs (sans trailing slash, HTTPS obligatoire).
