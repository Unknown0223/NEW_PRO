# API Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). API versiyasi backend deploy bilan birga.

## Versioning policy

### Hozirgi model

- Barcha tenant API: `/api/:slug/...` (versiya prefiksi yo‘q).
- **Breaking change** (maydon o‘chirish, semantika o‘zgarishi, 4xx/5xx kod o‘zgarishi):
  1. `API_CHANGELOG.md` ga yoziladi (migration period bilan).
  2. Kamida **2 hafta** eski va yangi xatti-harakat parallel (feature flag yoki ixtiyoriy query).
  3. Mobile va frontend contract testlari yangilanadi (`npm run test:contracts`).

### Kelajak: `/api/v2/:slug/...`

- Faqat **breaking** o‘zgarishda yangi prefiks.
- `v1` (`/api/:slug`) kamida 6 oy qo‘llab-quvvatlanadi.
- OpenAPI: `npm run openapi:generate` — `info.version` semver (major = breaking).

### Non-breaking

- Yangi ixtiyoriy maydonlar, yangi endpoint, kengaytirilgan filter — changelog `Added` bo‘limi, versiya o‘zgarmaydi.

---

## [Unreleased]

### Added
- `GET /api/:slug/metrics/business` — tenant KPI (orders today, active users) — JWT talab qilinadi
- `GET /metrics/business` — aggregate KPI — `x-internal-token` (prod)
- `job_log` jadvali — BullMQ worker audit
- `/metrics` Prometheus endpoint (S4, token bilan prod)

### Changed
- Redis cache kalitlari: `t:{tenantId}:` prefiksi (horizontal scaling)
- `LOG_SAMPLE_RATE` — verbose request log sampling

### Security
- `/ready` — `INTERNAL_HEALTH_TOKEN` (S3-05)
- Production: `RBAC_ENFORCE_PERMISSIONS=1` majburiy

## [2026-07] — Foundation

- Multi-tenant `/api/:slug/*` marshrutlar
- RBAC strukturali ruxsatlar
- Order automation qoidalari
- Mobile sync API
