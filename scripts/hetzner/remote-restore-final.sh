#!/bin/bash
set -euo pipefail
cd /opt/salec/infrastructure
set -a
source .env.production
set +a

DUMP_NAME="${DUMP_NAME:-}"
if [ -z "$DUMP_NAME" ]; then
  DUMP_NAME=$(basename "$(readlink -f /opt/salec/backups/salec_latest.dump)")
fi
DUMP=/opt/salec/backups/$DUMP_NAME
test -f "$DUMP"
echo "Using dump: $DUMP"
# relative symlink so docker volume sees it
ln -sfn "$DUMP_NAME" /opt/salec/backups/salec_full.dump
ln -sfn "$DUMP_NAME" /opt/salec/backups/salec_latest.dump
ls -lh /opt/salec/backups/salec_full.dump

echo "Stopping app..."
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend frontend || true

echo "Recreate savdo_db..."
docker exec salec-postgres-1 \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='savdo_db' AND pid <> pg_backend_pid();" || true
docker exec salec-postgres-1 \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS savdo_db;"
docker exec salec-postgres-1 \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE savdo_db OWNER postgres;"

echo "pg_restore $(date -u)..."
docker run --rm --network salec_salec \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  -v /opt/salec/backups:/backups:ro \
  postgres:18-alpine \
  pg_restore -h salec-postgres-1 -U postgres -d savdo_db --no-owner --role=postgres \
  "/backups/$DUMP_NAME" > /opt/salec/backups/pg_restore_final.log 2>&1 || true

TABLES=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
CLIENTS=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM clients;" 2>/dev/null || echo 0)
ORDERS=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM orders;" 2>/dev/null || echo 0)
USERS=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo 0)
PHOTOS=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM client_photo_reports;" 2>/dev/null || echo 0)
CPAY=$(docker exec salec-postgres-1 psql -U postgres -d savdo_db -tAc "SELECT count(*) FROM client_payments;" 2>/dev/null || echo 0)
echo "PUBLIC_TABLES=$TABLES USERS=$USERS CLIENTS=$CLIENTS ORDERS=$ORDERS PHOTOS=$PHOTOS CLIENT_PAYMENTS=$CPAY" | tee /opt/salec/backups/restore_counts.txt

docker compose -f docker-compose.prod.yml --env-file .env.production up -d
sleep 10
curl -fsS http://127.0.0.1:4000/health || true
echo
if [ "${TABLES:-0}" -lt 120 ] || [ "${CLIENTS:-0}" -lt 10000 ]; then
  echo RESTORE_FAIL
  tail -40 /opt/salec/backups/pg_restore_final.log
  exit 1
fi
echo RESTORE_OK
