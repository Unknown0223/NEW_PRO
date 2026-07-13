# BullMQ worker operations

## Navbatlar

| Queue | Maqsad | Worker |
|-------|--------|--------|
| `background` | Order status notify, cache warm, audit retention | `Dockerfile.worker` |

Redis: `REDIS_URL` yoki Sentinel (`REDIS_SENTINEL_HOSTS`).

## Monitoring

### Grafana / Prometheus

- Worker process: `process_*` metrikalar (agar `/metrics` workerda yoqilgan bo‘lsa).
- Failed job soni: `job_log` jadvalidan:

```sql
SELECT status, COUNT(*) FROM job_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Bull Board (ixtiyoriy)

Staging uchun Bull Board ulash mumkin — productionda faqat VPN + admin token bilan.

```bash
# Kelajak: BULL_BOARD_ENABLED=1 staging only
```

## Retry va DLQ siyosati

| Holat | Harakat |
|-------|---------|
| Transient xato (DB timeout, Redis) | 3 retry, exponential backoff (BullMQ default) |
| Validation / business xato | Darhol `failed`, qayta urinilmaydi |
| 3 marta failed | `job_log.status = 'failed'`, alert |

### Dead letter queue (DLQ)

Hozir alohida DLQ queue yo‘q — failed joblar `job_log` + BullMQ `failed` setida.

**Reja:**

1. `background-dlq` queue — manual replay uchun.
2. Alert: failed job > 5 / 15 daqiqa → Slack/Telegram webhook (`WORKER_ALERT_WEBHOOK_URL`).

## Alertlar

```yaml
# Grafana alert (misol)
- alert: BullMQFailedJobsHigh
  expr: increase(job_log_failed_total[15m]) > 5
  for: 5m
```

Webhook sozlash: Railway env `WORKER_ALERT_WEBHOOK_URL` (ixtiyoriy).

## Rollback

1. Worker deploy ni oldingi image ga qaytaring (`railway redeploy`).
2. Stuck joblar: Bull Board yoki `redis-cli` orqali `DEL bull:background:*` **faqat** stagingda.
3. Production: `docs/BACKUP_AND_DR.md` — `backup:pre-release` checklist.

Batafsil zaxira: [BACKUP_AND_DR.md](./BACKUP_AND_DR.md).
