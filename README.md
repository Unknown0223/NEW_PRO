# SALEC — Savdo / distribyutsiya platformasi

Monorepo: **backend** (Fastify API), **frontend** (Next.js panel), **mobile** (Flutter), **infrastructure** (Docker).

## Tez boshlash

```bash
# 1. PostgreSQL + Redis
docker compose -f infrastructure/docker-compose.yml up -d postgres redis

# 2. Backend
cd backend && cp .env.example .env && npm ci
npm run db:deploy && npm run db:seed && npm run dev

# 3. Frontend
cd frontend && npm ci && npm run dev
```

Batafsil: [docs/ONBOARDING.md](docs/ONBOARDING.md)

## Struktura

| Papka | Tavsif |
|-------|--------|
| `backend/` | API, worker, Prisma, testlar |
| `frontend/` | Admin panel (Next.js 14) |
| `mobile/` | Agent / expeditor / supervisor ilova |
| `infrastructure/` | Docker Compose, nginx misollari |
| `docs/` | ADR, backup, onboarding, API changelog |

## Muhit o'zgaruvchilari

- Backend namuna: `backend/.env.example`
- Production: `CORS_ALLOWED_ORIGINS`, JWT secrets, `DATABASE_URL`, `REDIS_URL`
- Monitoring (ixtiyoriy): `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_SAMPLE_RATE`
- Object storage (ixtiyoriy): `STORAGE_*` (R2/S3)

## Asosiy skriptlar

```bash
cd backend
npm run dev              # API
npm run worker:dev       # BullMQ worker
npm run build            # TypeScript compile
npm run test:ci          # Vitest
npm run prod:verify      # Release gate
npm run backup:pre-release
```

```bash
cd frontend
npm run dev
npm run test:ci
npm run analyze          # Bundle analyzer (ANALYZE=true)
```

```bash
cd mobile
flutter test
```

## Hujjatlar

- [Backup & DR](docs/BACKUP_AND_DR.md)
- [Uptime monitoring](docs/UPTIME_MONITORING.md)
- [Cost management](docs/COST_MANAGEMENT.md)
- [API Changelog](docs/API_CHANGELOG.md)
- [ADR](docs/adr/ADR-001-fastify.md)

## CI

GitHub Actions: `.github/workflows/ci.yml` (backend + frontend), `mobile.yml`, `uptime-monitor.yml`, `dr-drill.yml`.

## Cursor

Jamoa qoidalari: `.cursor/rules/project-standards.mdc`, `.cursor/rules/security-checklist.mdc`
