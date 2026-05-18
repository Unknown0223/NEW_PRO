# Grafana — API observability (Foundation P2 #9)

Bog‘liq: `docs/SLO_AND_OBSERVABILITY.md`, `request-observability.plugin.ts` (`slow_request`, `responseTimeMs`).

## Maqsad

- **p95** va **5xx** ulushi — release oldidan ko‘rinish.
- **slow_request** (≥ 500 ms) — qaysi `path` sekinlashyapti.
- Dashboard endpointlari — `dashboard.request` (faqat `DASHBOARD_PERF_LOG=1`).

## Loki (JSON loglar)

Datasource: Loki, label `app=salec-backend` (deploy konfiguratsiyasiga moslang).

| Panel | LogQL (misol) |
|-------|----------------|
| Slow request rate | `sum(rate({app="salec-backend"} \|= "slow_request" [5m]))` |
| p95 response time | `quantile_over_time(0.95, {app="salec-backend"} \|= "request_complete" \| json \| unwrap responseTimeMs [1h]) by (path)` |
| 5xx count | `sum(count_over_time({app="salec-backend"} \|= "request_complete" \| json \| statusCode >= 500 [5m]))` |
| Top slow paths | `topk(10, sum by (path) (count_over_time({app="salec-backend"} \|= "slow_request" [24h])))` |
| Dashboard duration | `{app="salec-backend"} \|= "dashboard.request" \| json` |

## Import

Batafsil: [`docs/grafana/IMPORT.md`](../../docs/grafana/IMPORT.md).

`docs/grafana/dashboard-foundation-api.json` — Grafana 10+ da **Import → Upload JSON**. Datasource UID ni muhitingizdagi Loki ga moslang (`${datasource}` o‘rniga).

CI: `npm run foundation:verify:fast` — JSON sintaksis tekshiriladi.

## Alert (tavsiya)

- `slow_request` rate > N / 5m (stagingda kalibrlash).
- `statusCode=503` on `/ready` (readiness).
- p95 > 500 ms 15 daqiqa davomida (asosiy CRUD path lar uchun).

## Keyingi qadam

Prometheus exporter yoki log shipping CI ga ulang; panel UID larni environment bo‘yicha alohida saqlang.
