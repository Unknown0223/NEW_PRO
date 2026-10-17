#!/bin/bash
# Har 10 daqiqada (cron): disk, Postgres va API holati.
#   >= DISK_WARN_PCT (80)  — ogohlantirish (6 soatda bir marta)
#   >= DISK_CRIT_PCT (92)  — 5 GB favqulodda zaxira fayl o'chiriladi + jiddiy ogohlantirish (soatda bir marta)
#   <  70                  — zaxira fayl qayta yaratiladi
set -uo pipefail

WARN=${DISK_WARN_PCT:-80}
CRIT=${DISK_CRIT_PCT:-92}
BALLAST=/opt/salec/EMERGENCY_BALLAST
BALLAST_SIZE=5G
STATE=/var/lib/salec-ops
ALERT=/opt/salec/scripts/salec-alert.sh
mkdir -p "$STATE"

# $1 = kalit, $2 = daqiqa: oxirgi xabardan beri shuncha vaqt o'tgan bo'lsa 0 qaytaradi.
due() {
  local f="$STATE/$1"
  if [ -f "$f" ] && [ $(( $(date +%s) - $(stat -c %Y "$f") )) -lt $(( $2 * 60 )) ]; then
    return 1
  fi
  touch "$f"
}

pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
avail=$(df -h --output=avail / | tail -1 | tr -d ' ')

if [ "$pct" -ge "$CRIT" ]; then
  extra=""
  if [ -f "$BALLAST" ]; then
    rm -f "$BALLAST"
    extra=" Аварийный резерв ${BALLAST_SIZE} удалён, чтобы база не остановилась."
  fi
  due disk_crit 60 && "$ALERT" crit "Диск сервера почти заполнен: ${pct}%" \
    "Свободно ${avail}.${extra} Срочно освободите место (резервные копии, кэш Docker)."
elif [ "$pct" -ge "$WARN" ]; then
  due disk_warn 360 && "$ALERT" warn "Диск сервера: ${pct}%" \
    "Свободно ${avail}. Проверьте /opt/salec/backups и кэш Docker."
else
  rm -f "$STATE/disk_warn" "$STATE/disk_crit"
  if [ ! -f "$BALLAST" ] && [ "$pct" -lt 70 ]; then
    fallocate -l "$BALLAST_SIZE" "$BALLAST" 2>/dev/null || true
  fi
fi

if ! docker exec salec-postgres-1 pg_isready -q -U postgres >/dev/null 2>&1; then
  due pg_down 30 && "$ALERT" crit "База данных не отвечает" "salec-postgres-1: pg_isready не прошёл. Проверьте docker logs salec-postgres-1."
else
  rm -f "$STATE/pg_down"
fi

if ! curl -sf -m 10 -o /dev/null http://127.0.0.1:4000/health; then
  due api_down 30 && "$ALERT" crit "API не отвечает" "http://127.0.0.1:4000/health недоступен. Проверьте salec-backend-1."
else
  rm -f "$STATE/api_down"
fi

echo "$(date -u +%FT%TZ) disk=${pct}% avail=${avail}"
