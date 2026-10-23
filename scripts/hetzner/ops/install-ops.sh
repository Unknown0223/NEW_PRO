#!/bin/bash
# Serverda bir marta (yoki yangilashda) ishga tushiriladi: skriptlar, cron, logrotate, favqulodda zaxira fayl.
#   scp scripts/hetzner/ops/*.sh root@server:/opt/salec/scripts/ && ssh root@server bash /opt/salec/scripts/install-ops.sh
set -euo pipefail

D=/opt/salec/scripts
for f in salec-alert.sh disk-guard.sh daily-pg-backup.sh offsite-backup.sh install-ops.sh; do
  if [ -f "$D/$f" ]; then
    sed -i 's/\r$//' "$D/$f"
    chmod 755 "$D/$f"
  fi
done
mkdir -p /var/lib/salec-ops

if [ ! -f /opt/salec/EMERGENCY_BALLAST ]; then
  fallocate -l 5G /opt/salec/EMERGENCY_BALLAST
fi

if ! command -v restic >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq restic >/dev/null
fi

{
  crontab -l 2>/dev/null | grep -v -e 'disk-guard.sh' -e 'daily-pg-backup.sh' -e 'builder prune' || true
  echo '*/10 * * * * /opt/salec/scripts/disk-guard.sh >> /var/log/salec-disk-guard.log 2>&1'
  echo '15 2 * * * /opt/salec/scripts/daily-pg-backup.sh >> /opt/salec/backups/daily-backup.log 2>&1'
  echo '30 4 * * 0 docker builder prune -af --filter until=168h >> /var/log/salec-docker-prune.log 2>&1'
} | crontab -

cat > /etc/logrotate.d/salec-ops <<'EOF'
/var/log/salec-disk-guard.log /var/log/salec-alerts.log /var/log/salec-docker-prune.log /opt/salec/backups/daily-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

crontab -l
ls -lh /opt/salec/EMERGENCY_BALLAST
restic version
echo INSTALL_OPS_OK
