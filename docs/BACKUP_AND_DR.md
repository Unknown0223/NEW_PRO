# SALEC — Backup va Disaster Recovery

## Maqsadlar

| Metrika | Maqsad |
|---------|--------|
| **RPO** (Recovery Point Objective) | 1 soat |
| **RTO** (Recovery Time Objective) | 4 soat |

## PostgreSQL backup

```bash
cd backend
export DATABASE_URL="postgresql://..."
npm run backup:pre-release
```

**Windows (PowerShell):**

```powershell
cd backend
$env:DATABASE_URL = "postgresql://..."
.\scripts\backup\pg-backup.ps1
```

Skriptlar: `backend/scripts/backup/pg-backup.sh` (bash), `pg-backup.ps1` (PowerShell) — `pg_dump` → `backups/postgres/salec_<timestamp>.sql.gz`

**Retention:** default 14 kun (`BACKUP_RETENTION_DAYS`).

## Redis

Docker Compose: AOF yoqilgan (`appendonly yes`, `appendfsync everysec`). Production Redis (Railway/Upstash) uchun provider snapshot/AOF sozlamalarini tekshiring.

## BullMQ job log

`job_log` jadvali — fon ishlar natijasi audit uchun. Worker har job tugagach yozadi.

## DR drill

```bash
bash backend/scripts/dr-drill.sh
```

**Windows:**

```powershell
cd backend
.\scripts\dr-drill.ps1
```

CI: `.github/workflows/dr-drill.yml` (oylik schedule + `workflow_dispatch`).

## Restore (qisqa)

```bash
gunzip -c backups/postgres/salec_YYYYMMDD.sql.gz | psql "$DATABASE_URL"
cd backend && npm run db:deploy
```

## Release oldidan checklist

1. `npm run backup:pre-release`
2. Migratsiya rejasini ko‘rib chiqish (`prisma migrate deploy`)
3. Staging smoke (`/health`, `/ready`)
4. Rollback: oldingi backup + oldingi deploy image
