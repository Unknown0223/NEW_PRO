#!/usr/bin/env bash
# Yangi VPS dagi Postgres ga dump tiklash.
# Dump: salec_*.sql.gz  yoki  pg_dump -Fc  (*.dump)
set -euo pipefail

DUMP="${1:?usage: restore-pg.sh <dump.sql.gz|dump.dump>}"
COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-infrastructure/.env.production}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump topilmadi: $DUMP" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env topilmadi: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Restore: $DUMP → postgres/savdo_db"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_isready -U postgres -d savdo_db

if [[ "$DUMP" == *.dump ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_restore -U postgres -d savdo_db --no-owner --role=postgres --clean --if-exists < "$DUMP"
elif [[ "$DUMP" == *.gz ]]; then
  gzip -dc "$DUMP" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U postgres -d savdo_db
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U postgres -d savdo_db < "$DUMP"
fi

echo "OK. Keyin: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --build"
