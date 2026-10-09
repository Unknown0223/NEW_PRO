#!/bin/bash
set -euo pipefail
# Free space: keep only newest daily + one final slot
mkdir -p /opt/salec/backups
cd /opt/salec/backups
# remove old full dumps except daily_latest target and newest daily
ls -1t daily_*.dump 2>/dev/null | tail -n +2 | xargs -r rm -f
rm -f salec_full.dump salec_final_20260925T065632Z.dump
df -h /
export DATABASE_URL=$(cat /root/.mig-pg-url)
rm -f /root/.mig-pg-url
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/opt/salec/backups/salec_final_$TS.dump
echo "FINAL dump start $TS" | tee /opt/salec/backups/final-dump.out
docker run --rm \
  -e "DATABASE_URL=$DATABASE_URL" \
  -v /opt/salec/backups:/out \
  postgres:18-alpine \
  sh -c 'pg_dump "$DATABASE_URL" -Fc --no-owner --no-acl -f /out/salec_final.dump; ls -lh /out/salec_final.dump; echo FINAL_DUMP_DONE'
mv -f /opt/salec/backups/salec_final.dump "$OUT"
ln -sfn "$OUT" /opt/salec/backups/salec_latest.dump
ln -sfn "$OUT" /opt/salec/backups/salec_full.dump
echo "SAVED=$OUT" | tee -a /opt/salec/backups/final-dump.out
echo FINAL_DUMP_DONE | tee -a /opt/salec/backups/final-dump.out
