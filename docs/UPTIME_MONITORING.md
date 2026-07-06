# Uptime monitoring

## GitHub Actions (repo ichida)

`.github/workflows/uptime-monitor.yml` — har 15 daqiqada `/health` tekshiruvi.

**Sozlash (GitHub repo Variables):**

| Variable | Misol |
|----------|-------|
| `PRODUCTION_HEALTH_URL` | `https://api.example.com/health` |
| `PRODUCTION_READY_URL` | `https://api.example.com/ready` |

**Secret:** `INTERNAL_HEALTH_TOKEN` — `/ready` uchun `x-internal-token` header.

## Tashqi monitoring (UptimeRobot)

1. [UptimeRobot](https://uptimerobot.com) da HTTP(s) monitor yarating.
2. URL: `https://<backend-host>/health` — 200 + JSON `status: ok`.
3. Alert: email/Telegram/Slack.
4. `/ready` uchun alohida monitor (token bilan) — 503 bo‘lsa alert.

## SLO bog‘liqlik

Batafsil: `docs/SLO_AND_OBSERVABILITY.md`, `backend/docs/observability-grafana.md`.
