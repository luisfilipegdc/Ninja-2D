#!/bin/bash
# Setup inicial da VPS para o Mapa Interativo — pluzy.com.br
# Execute como root: bash vps-setup.sh
set -e

REPO="https://github.com/luisfilipegdc/festajuninamarista.git"
APP_DIR="/var/www/festajuninamarista"
DOMAIN="pluzy.com.br"
APP_PORT=3000

# ── 1. Pacotes base ────────────────────────────────────────────────────────────
echo "==> Atualizando pacotes..."
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx

# ── 2. Node.js 20 LTS via NodeSource ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "==> Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# ── 3. PM2 (process manager) ──────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "==> Instalando PM2..."
  npm install -g pm2
  pm2 startup systemd -u root --hp /root | bash || true
fi

# ── 4. Clone do repositório ───────────────────────────────────────────────────
echo "==> Clonando repositório..."
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  echo "    Repositório já existe — atualizando..."
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 5. Arquivo .env.local (edite antes de executar, ou preencha abaixo) ───────
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "==> Criando .env.local..."
  cat > "$APP_DIR/.env.local" << 'ENV'
NEXT_PUBLIC_SUPABASE_URL=COLE_AQUI_A_URL_DO_SUPABASE
NEXT_PUBLIC_SUPABASE_ANON_KEY=COLE_AQUI_A_ANON_KEY_DO_SUPABASE
ENV
  echo ""
  echo "ATENÇÃO: Edite $APP_DIR/.env.local com suas credenciais Supabase antes de continuar!"
  echo "         Execute: nano $APP_DIR/.env.local"
  echo "         Depois rode este script novamente OU continue a partir do passo 6 manualmente."
  echo ""
fi

# ── 6. Build da aplicação ─────────────────────────────────────────────────────
echo "==> Instalando dependências..."
npm ci --omit=dev

echo "==> Fazendo build..."
npm run build

# ── 7. Inicia com PM2 ─────────────────────────────────────────────────────────
echo "==> Iniciando app com PM2..."
pm2 delete mapa 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# ── 8. Nginx ──────────────────────────────────────────────────────────────────
echo "==> Configurando Nginx..."
cat > /etc/nginx/sites-available/pluzy << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Proxy de tudo para o Next.js (incluindo /mapa)
    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Arquivos estáticos do Next.js (_next/static)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$APP_PORT/_next/static/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Health check
    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/pluzy /etc/nginx/sites-enabled/pluzy
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 9. SSL com Let's Encrypt ──────────────────────────────────────────────────
echo "==> Configurando SSL (Let's Encrypt)..."
echo "    Certifique-se de que $DOMAIN aponta para este servidor antes de continuar."
read -p "DNS já está apontando para este IP? (s/n): " dns_ok
if [ "$dns_ok" = "s" ] || [ "$dns_ok" = "S" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "COLE_SEU_EMAIL_AQUI"
  systemctl reload nginx
  echo "==> SSL configurado com sucesso!"
else
  echo "    Pulando SSL. Rode depois: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

# ── Resumo final ──────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Setup concluído!"
echo "  App rodando em: http://$DOMAIN/mapa"
echo "  PM2 status:     pm2 status"
echo "  Logs:           pm2 logs mapa"
echo "  Nginx logs:     tail -f /var/log/nginx/error.log"
echo "=============================================="
