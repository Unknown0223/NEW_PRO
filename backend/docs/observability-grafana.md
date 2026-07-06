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

| Alert | Shart | Severity | Harakat |
|-------|-------|----------|---------|
| Slow request spike | `slow_request` rate > 10/min 5 daqiqa | warning | Path bo‘yicha profiling |
| Readiness down | `/ready` statusCode=503 | critical | DB/Redis tekshiruv |
| High p95 | p95 > 500 ms 15 daqiqa | warning | Indeks / N+1 audit |
| 5xx burst | 5xx > 1% 5 daqiqa | critical | Sentry + rollback ko‘rib chiqish |
| Business KPI drop | `orders_today` anomaly (custom) | info | Tenant-scoped `/metrics/business` |

### Prometheus alert qoidalari (misol)

`/metrics` endpointidan (token bilan):

```yaml
groups:
  - name: salec-api
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API 5xx rate above 1%"
      - alert: SlowRequests
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.5
        for: 15m
        labels:
          severity: warning
```

## Prometheus

`/metrics` — `metrics.plugin.ts` (S4-04). Production: `x-internal-token` = `INTERNAL_HEALTH_TOKEN`.

Dashboard JSON: `docs/grafana/dashboard-foundation-api.json` — Loki panellar bilan birga import qiling.

## Keyingi qadam

Prometheus alertmanager yoki Grafana alerting ulang; panel UID larni environment bo‘yicha alohida saqlang.
