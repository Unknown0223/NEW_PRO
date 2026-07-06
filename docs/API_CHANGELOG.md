# API Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). API versiyasi backend deploy bilan birga.

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
