#!/bin/bash
# Ogohlantirish: ilova ichidagi bildirishnoma (admin/direktor) + ixtiyoriy Telegram.
#   salec-alert.sh <warn|crit|info> "<sarlavha>" "<matn>"
# Telegram uchun /opt/salec/scripts/alert.env:
#   ALERT_TG_CHAT=123456789          # bir nechta: vergul bilan
#   ALERT_TG_TOKEN=...               # bo'lmasa .env.production dagi TELEGRAM_BOT_TOKEN
set -uo pipefail

LEVEL="${1:-info}"
TITLE="${2:-SALEC}"
BODY="${3:-}"
ENV_FILE=/opt/salec/infrastructure/.env.production
ALERT_ENV=/opt/salec/scripts/alert.env
LOG=/var/log/salec-alerts.log

ALERT_TG_CHAT=""
ALERT_TG_TOKEN=""
# shellcheck disable=SC1090
[ -f "$ALERT_ENV" ] && . "$ALERT_ENV"

echo "$(date -u +%FT%TZ) [$LEVEL] $TITLE: $BODY" >> "$LOG"
logger -t salec-alert "[$LEVEL] $TITLE: $BODY" 2>/dev/null || true

if [ -n "$ALERT_TG_CHAT" ]; then
  token="$ALERT_TG_TOKEN"
  if [ -z "$token" ] && [ -f "$ENV_FILE" ]; then
    token=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'\r")
  fi
  if [ -n "$token" ]; then
    icon="ℹ️"
    [ "$LEVEL" = "warn" ] && icon="⚠️"
    [ "$LEVEL" = "crit" ] && icon="🚨"
    IFS=',' read -ra chats <<< "$ALERT_TG_CHAT"
    for chat in "${chats[@]}"; do
      curl -s -m 15 -o /dev/null "https://api.telegram.org/bot${token}/sendMessage" \
        --data-urlencode "chat_id=${chat}" \
        --data-urlencode "text=${icon} ${TITLE}
${BODY}
($(hostname))" || true
    done
  fi
fi

sql_escape() { printf "%s" "$1" | sed "s/'/''/g"; }
t=$(sql_escape "${TITLE:0:180}")
b=$(sql_escape "$BODY")
docker exec -i salec-postgres-1 psql -U postgres -d savdo_db -q >/dev/null 2>&1 <<SQL || true
INSERT INTO in_app_notifications (tenant_id, user_id, title, body)
SELECT tenant_id, id, '$t', '$b' FROM users WHERE is_active AND role IN ('admin', 'director');
SQL
