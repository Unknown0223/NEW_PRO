#!/usr/bin/env bash
# PostgreSQL backup — release oldidan yoki cron orqali.
# Talab: pg_dump, DATABASE_URL muhit o'zgaruvchisi.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/postgres}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/salec_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Backing up to $FILE ..."
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$FILE"
echo "Done: $FILE ($(du -h "$FILE" | cut -f1))"

# Eski backup retention (default 14 kun)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
find "$BACKUP_DIR" -name 'salec_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
