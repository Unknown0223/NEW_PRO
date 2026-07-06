#!/usr/bin/env bash
# DR drill — backup mavjudligini va restore skriptini tekshiradi (dry-run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/postgres}"

echo "=== SALEC DR Drill ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "WARN: DATABASE_URL not set — skip connectivity check"
else
  echo "Checking database connectivity..."
  psql "$DATABASE_URL" -c "SELECT 1 AS ok;" >/dev/null
  echo "OK: database reachable"
fi

LATEST="$(ls -t "$BACKUP_DIR"/salec_*.sql.gz 2>/dev/null | head -1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "WARN: no backup found in $BACKUP_DIR — run npm run backup:pre-release"
  exit 1
fi

echo "Latest backup: $LATEST"
SIZE="$(du -h "$LATEST" | cut -f1)"
echo "Size: $SIZE"

# Restore dry-run: gzip integrity
gzip -t "$LATEST"
echo "OK: backup gzip integrity"

echo "=== DR drill passed (dry-run) ==="
