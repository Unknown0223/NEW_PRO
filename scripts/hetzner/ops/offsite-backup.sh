#!/bin/bash
# Serverdan tashqari zaxira (restic → Hetzner Storage Box, SFTP port 23).
# daily-pg-backup.sh dan keyin chaqiriladi:  offsite-backup.sh /opt/salec/backups/daily_....dump
# Sozlama yo'q bo'lsa jim chiqadi.
#
# /opt/salec/scripts/offsite.env (chmod 600):
#   RESTIC_REPOSITORY=sftp:uXXXXXX@uXXXXXX.your-storagebox.de:/home/salec-restic
#   RESTIC_PASSWORD_FILE=/root/.restic-salec-password
# SSH kalit: /root/.ssh/config da Host uXXXXXX.your-storagebox.de → Port 23, IdentityFile ...
set -uo pipefail

CONF=/opt/salec/scripts/offsite.env
ALERT=/opt/salec/scripts/salec-alert.sh
UPLOADS=/var/lib/docker/volumes/salec_backend_uploads/_data
STATE=/var/lib/salec-ops
DUMP="${1:-}"

[ -f "$CONF" ] || exit 0
command -v restic >/dev/null 2>&1 || { "$ALERT" warn "Внешняя копия не создана" "restic не установлен"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$CONF"
set +a

fail() {
  "$ALERT" crit "Внешняя резервная копия не создана" "$1"
  echo "$(date -u +%FT%TZ) OFFSITE FAIL: $1"
  exit 1
}

if [ -n "$DUMP" ]; then
  restic backup --quiet --tag db "$DUMP" || fail "restic backup (БД) завершился с ошибкой"
fi
if [ -d "$UPLOADS" ]; then
  restic backup --quiet --tag uploads "$UPLOADS" || fail "restic backup (uploads) завершился с ошибкой"
fi

restic forget --quiet --tag db --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune \
  || fail "restic forget/prune завершился с ошибкой"
restic forget --quiet --tag uploads --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune \
  || fail "restic forget/prune (uploads) завершился с ошибкой"

# Haftada bir marta: ma'lumotning 5% ini o'qib tekshirish.
mkdir -p "$STATE"
if [ ! -f "$STATE/restic_check" ] || [ $(( $(date +%s) - $(stat -c %Y "$STATE/restic_check") )) -gt 604800 ]; then
  restic check --read-data-subset=5% --quiet || fail "restic check: репозиторий повреждён"
  touch "$STATE/restic_check"
fi

echo "$(date -u +%FT%TZ) offsite ok"
