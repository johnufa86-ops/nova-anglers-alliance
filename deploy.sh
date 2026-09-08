#!/usr/bin/env bash
set -e

echo "===================================================="
echo "  NOVA ANGLERS ALLIANCE — Автодеплой на Ubuntu"
echo "  Сервер: 28590.koara.live (212.113.99.93)"
echo "===================================================="

# 1. Обновление пакетов и установка зависимостей
echo "--> 1. Установка Node.js, Git и Caddy..."
sudo apt-get update -y
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl git ufw

# Установка Caddy (автоматический HTTPS)
if ! command -v caddy &> /dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update -y
    sudo apt-get install -y caddy
fi

# Установка Node.js 20 LTS
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Установка PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"

# 2. Клонирование / обновление репозитория
APP_DIR="/var/www/nova-anglers-alliance"
if [ ! -d "$APP_DIR" ]; then
    echo "--> 2. Клонирование репозитория в $APP_DIR..."
    sudo mkdir -p /var/www
    sudo git clone https://github.com/johnufa86-ops/nova-anglers-alliance.git "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
else
    echo "--> 2. Обновление репозитория в $APP_DIR..."
    cd "$APP_DIR"
    git pull origin main
fi

cd "$APP_DIR"

# 3. Настройка .env
echo "--> 3. Проверка .env..."
cat << 'EOF' > .env
PAYMENT_ONLINE_ENABLED=false
PAYMENT_BANK_TRANSFER_ENABLED=true
BANK_TRANSFER_TIMEOUT_HOURS=48

DATABASE_URL="postgresql://postgres.oaarqdjbdeczzgzpbagi:iNA-KhT-MZx-6R9@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?pgbouncer=true"

NEXTAUTH_SECRET="nova-anglers-alliance-secret-key-2026-change-me"
NEXTAUTH_URL="https://28590.koara.live"
APP_SECRET="nova-2026-production-secret-secure-key"

STORAGE_PROVIDER="local"
UPLOAD_DIR="./uploads"
EOF

# 4. Установка npm-зависимостей и сборка
echo "--> 4. Установка зависимостей и сборка..."
npm install
npm run build

# 5. Запуск через PM2
echo "--> 5. Запуск приложения в PM2..."
pm2 stop nova 2>/dev/null || true
pm2 delete nova 2>/dev/null || true
pm2 start npm --name "nova" -- start
pm2 save

# 6. Настройка Caddy для домена 28590.koara.live и IP
echo "--> 6. Настройка веб-сервера Caddy..."
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
28590.koara.live, 212.113.99.93 {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
EOF

sudo systemctl restart caddy

echo "===================================================="
echo "  УСПЕХ! Сайт запущен и доступен:"
echo "  https://28590.koara.live"
echo "  http://212.113.99.93"
echo "===================================================="
