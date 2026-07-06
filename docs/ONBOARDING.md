# SALEC — loyiha onboarding

## 1. Talablar

- Node.js 20+, Docker Desktop, Git
- Flutter 3.2+ (mobil ishlari uchun)
- PostgreSQL 16, Redis 7 (Docker orqali)

## 2. Birinchi ishga tushirish

```bash
# Infra
cp infrastructure/.env.local.example infrastructure/.env.local
# POSTGRES_PASSWORD ni to'ldiring
docker compose -f infrastructure/docker-compose.yml up -d postgres redis

# Backend
cd backend
cp .env.example .env
# DATABASE_URL, JWT secrets
npm ci
npm run db:deploy
npm run db:seed
npm run dev

# Frontend (boshqa terminal)
cd frontend
npm ci
npm run dev
```

## 3. Testlar

```bash
cd backend && npm run test:ci
cd frontend && npm run test:ci
cd mobile && flutter test
```

## 4. Muhim skriptlar

| Skript | Maqsad |
|--------|--------|
| `npm run prod:verify` | Release oldidan to‘liq tekshiruv |
| `npm run backup:pre-release` | DB backup |
| `npm run dostup:verify` | RBAC tekshiruvi |
| `npm run foundation:verify:fast` | OpenAPI + Grafana JSON |

## 5. Arxitektura

- **Backend:** Fastify + Prisma + BullMQ
- **Frontend:** Next.js 14 (App Router)
- **Mobile:** Flutter (agent / expeditor / supervisor)

ADR: `docs/adr/`

## 6. Jamoa

- Cursor qoidalari: `.cursor/rules/`
- PR shablon: `.github/pull_request_template.md`
- Xavfsizlik: `.cursor/rules/security-checklist.mdc`
