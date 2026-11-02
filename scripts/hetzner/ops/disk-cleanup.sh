#!/bin/bash
# Har kuni: ishlatilmayotgan Docker keshi, jurnal va apt keshi.
# Ishlayotgan konteyner, baza va /opt/salec/backups ga tegmaydi.
set -uo pipefail

docker image prune -f >/dev/null 2>&1 || true
docker builder prune -af --filter until=24h >/dev/null 2>&1 || true
journalctl --vacuum-size=80M >/dev/null 2>&1 || true
apt-get clean >/dev/null 2>&1 || true

if [ -f /var/log/btmp.1 ]; then
  size=$(stat -c %s /var/log/btmp.1 2>/dev/null || echo 0)
  if [ "$size" -gt 20000000 ]; then
    rm -f /var/log/btmp.1
  fi
fi

echo "$(date -u +%FT%TZ) cleanup $(df -h / | tail -1)"
