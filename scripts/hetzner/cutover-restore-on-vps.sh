#!/usr/bin/env bash
# Hetzner VPS da ishga tushiring (SSH yoki Coolify terminal).
# Eski Railway o'chirilMAYDI — faqat yangi Postgres qayta tiklanadi.
# Usage:
#   DUMP=/root/salec_final_XXXX.dump bash scripts/hetzner/cutover-restore-on-vps.sh
set -euo pipefail

DUMP="${DUMP:?set DUMP=/path/to/salec_final_*.dump}"
COMPOSE_DIR="${COMPOSE_DIR:-/data/salec}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.prod.yml}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump topilmadi: $DUMP" >&2
  exit 1
fi

echo "=== Containers ==="
cd "$COMPOSE_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "=== Stop backend/frontend (yozishni to'xtatish) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop backend frontend || true

echo "=== Ensure postgres up ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
sleep 3

PG_CID="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres)"
if [[ -z "$PG_CID" ]]; then
  echo "Postgres konteyner topilmadi" >&2
  exit 1
fi

echo "=== Drop+create public schema (to'liq almashtirish, Railway o'zgarmaydi) ==="
docker exec -i "$PG_CID" psql -U postgres -d savdo_db -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "=== pg_restore ==="
docker exec -i "$PG_CID" pg_restore -U postgres -d savdo_db --no-owner --role=postgres --verbose < "$DUMP" \
  || echo "(pg_restore ba'zi WARNING berishi mumkin — tekshiramiz)"

echo "=== Counts ==="
docker exec -i "$PG_CID" psql -U postgres -d savdo_db -c "
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tables,
  (SELECT count(*) FROM clients) AS clients,
  (SELECT count(*) FROM orders) AS orders,
  (SELECT count(*) FROM payments) AS payments,
  (SELECT count(*) FROM client_photo_reports) AS photos,
  (SELECT count(*) FROM users) AS users,
  (SELECT count(*) FROM products) AS products;
"

echo "=== Start backend/frontend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
sleep 8
curl -fsS http://127.0.0.1:4000/health || true
echo
echo "OK. Railway ni O'CHIRMANg — solishtirish uchun saqlang."
echo "Veb: http://157.180.116.50:3000"
echo "API: http://157.180.116.50:4000"
