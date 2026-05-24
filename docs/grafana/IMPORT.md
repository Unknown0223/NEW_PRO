# Grafana dashboard import (Foundation API)

Fayl: [`dashboard-foundation-api.json`](dashboard-foundation-api.json)

CI tekshiruvi: `cd backend && node scripts/perf/validate-grafana-dashboard.mjs`

## Qadamlar (Grafana 10+)

1. **Connections → Data sources** — Loki ulang (`app=salec-backend` label bilan mos log shipping).
2. **Dashboards → New → Import**.
3. **Upload JSON file** — `dashboard-foundation-api.json`.
4. Import wizardda **Loki** datasource tanlang (`${datasource}` o‘rniga).
5. **Import** — 4 ta panel: slow_request, p95 by path, 5xx, top slow paths.

## Log format

Backend `request-observability.plugin.ts` — `request_complete` / `slow_request` (JSON: `path`, `responseTimeMs`, `statusCode`).

## Alert (ixtiyoriy)

`backend/docs/observability-grafana.md` — LogQL va alert tavsiyalari.
