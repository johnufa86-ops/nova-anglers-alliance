#!/bin/bash
# ============================================================
# NOVA — сборка ZIP-архива проекта (Stage 5 + самоаудит)
# Исключает: .env, db/, storage/, node_modules, .next, логи
# ============================================================
set -e
cd /home/z/my-project

OUT=download/nova-anglers-alliance-stage6.zip
STAGE=$(date +%Y%m%d-%H%M%S)

rm -f "$OUT"
zip -qr "$OUT" . \
  -x ".env" \
  -x "db/*" \
  -x "storage/*" \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "*.log" \
  -x "dev.log" \
  -x "server.log" \
  -x ".git/*" \
  -x "download/*" \
  -x "upload/*" \
  -x "skills/*" \
  -x "mini-services/*" \
  -x "examples/*" \
  -x ".pgsupport/*" \
  -x ".local-pg/*" \
  -x "tsconfig.tsbuildinfo" \
  -x "worklog.md"

echo "=== $OUT собран ($STAGE) ==="
echo "Файлов: $(unzip -l "$OUT" | tail -1 | awk '{print $2}')"
echo ""
echo "=== Проверка отсутствия секретов и мусора ==="
if unzip -l "$OUT" | grep -qE "\.env$|/db/|/storage/|node_modules|\.log$"; then
  echo "❌ НАЙДЕНЫ ИСКЛЮЧЁННЫЕ ФАЙЛЫ!"
  unzip -l "$OUT" | grep -E "\.env$|/db/|/storage/|node_modules|\.log$"
  exit 1
else
  echo "✔ .env, db/, storage/, node_modules, логи — отсутствуют"
fi
unzip -l "$OUT" | grep -c "  " | awk '{print "Записей в архиве: " $1}'
