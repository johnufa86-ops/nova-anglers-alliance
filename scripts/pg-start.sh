#!/bin/bash
# ============================================================
# NOVA — локальный PostgreSQL для песочницы (PG 18.4 portable)
# Запуск: bash /home/z/my-project/scripts/pg-start.sh
# ============================================================
set -e

export LD_LIBRARY_PATH=/home/z/my-project/.pgsupport/icu60/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
PG_BIN=/home/z/my-project/node_modules/@embedded-postgres/linux-x64/native/bin
PGDATA=/home/z/my-project/db/pgdata
PGPORT=5433
SOCK=/home/z/my-project/db/pgsock
export PGHOST=127.0.0.1

if [ -f "$PGDATA/PG_VERSION" ]; then
  echo "Кластер уже инициализирован, пытаемся стартовать..."
  "$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $SOCK -c listen_addresses=127.0.0.1" -l /home/z/my-project/db/pg.log start || true
else
  echo "Инициализация кластера..."
  mkdir -p "$SOCK"
  "$PG_BIN/initdb" -D "$PGDATA" \
    --username=postgres \
    --pwfile=<(echo "postgres") \
    --no-locale \
    --encoding=UTF8 \
    --auth=scram-sha-256

  echo "Старт сервера..."
  "$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $SOCK -c listen_addresses=127.0.0.1" -l /home/z/my-project/db/pg.log start

  # Ждём готовности
  for i in $(seq 1 30); do
    "$PG_BIN/pg_isready" -h 127.0.0.1 -p $PGPORT && break
    sleep 1
  done

  echo "Создание ролей и БД..."
  PSQL() { "$PG_BIN/psql" -h 127.0.0.1 -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -c "$1"; }

  PSQL "DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nova') THEN
      CREATE ROLE nova LOGIN SUPERUSER PASSWORD 'nova_local';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nova_app') THEN
      CREATE ROLE nova_app LOGIN NOSUPERUSER PASSWORD 'nova_app_local';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
      CREATE ROLE anon LOGIN NOSUPERUSER PASSWORD 'anon_local';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
      CREATE ROLE authenticated LOGIN NOSUPERUSER PASSWORD 'auth_local';
    END IF;
  END \$\$;"

  PSQL "SELECT 'CREATE DATABASE nova OWNER nova' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='nova')\gexec"
  PSQL "ALTER DATABASE nova OWNER TO nova;"
fi

"$PG_BIN/pg_isready" -h 127.0.0.1 -p $PGPORT && echo "=== PostgreSQL готов: 127.0.0.1:$PGPORT ==="
