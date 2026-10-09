#!/bin/bash
# Kunlik pg_dump (cron 02:15 UTC). Oldin bo'sh joy tekshiriladi — joy yetmasa nusxa olinmaydi
# (disk to'lib Postgres yiqilmasin). Muvaffaqiyatsiz bo'lsa ogohlantirish yuboriladi.
set -euo pipefail

DIR=/opt/salec/backups
KEEP_DAYS=${BACKUP_KEEP_DAYS:-3}
RESERVE_BYTES=$(( 5 * 1024 * 1024 * 1024 ))
ALERT=/opt/salec/scripts/salec-alert.sh
OFFSITE=/opt/salec/scripts/offsite-backup.sh
GB=$(( 1024 * 1024 * 1024 ))

fail() {
  trap - ERR
  rm -f "$DIR"/*.partial
  "$ALERT" crit "Резервная копия БД не создана" "$1"
  echo "$(date -u +%FT%TZ) FAIL: $1"
  exit 1
}
trap 'fail "Ошибка в daily-pg-backup.sh, строка $LINENO"' ERR

cd /opt/salec/infrastructure
set -a
# shellcheck disable=SC1091
source .env.production
set +a

last=$(ls -t "$DIR"/daily_*.dump 2>/dev/null | head -1 || true)
need=$RESERVE_BYTES
if [ -n "$last" ]; then
  need=$(( $(stat -Lc %s "$last") * 3 / 2 + RESERVE_BYTES ))
fi
avail=$(df --output=avail -B1 "$DIR" | tail -1 | tr -d ' ')
if [ "$avail" -lt "$need" ]; then
  fail "Мало места: свободно $(( avail / GB )) ГБ, нужно $(( need / GB )) ГБ. Копия пропущена."
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DIR/daily_$TS.dump"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" salec-postgres-1 \
  pg_dump -U postgres -d savdo_db -Fc --no-owner --no-acl > "$OUT.partial"

if [ "$(head -c 5 "$OUT.partial")" != "PGDMP" ] || [ "$(stat -c %s "$OUT.partial")" -lt 1048576 ]; then
  fail "Файл копии повреждён или слишком мал: $OUT.partial"
fi
mv "$OUT.partial" "$OUT"
ln -sfn "$OUT" "$DIR/daily_latest.dump"

find "$DIR" -name 'daily_*.dump' -mtime +$(( KEEP_DAYS - 1 )) -delete
ls -lh "$OUT"

if [ -x "$OFFSITE" ]; then
  "$OFFSITE" "$OUT" || true
fi
