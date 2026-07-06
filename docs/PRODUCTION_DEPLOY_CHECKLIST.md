# SALEC — Production Deploy Checklist

Production deploy oldidan va keyin ushbu ro‘yxatni bajaring.

## 1. Muhit o‘zgaruvchilari

| O‘zgaruvchi | Majburiy | Default (dev) | Izoh |
|-------------|----------|---------------|------|
| `NODE_ENV` | **REQUIRED** prod | `development` | Production: `production` |
| `PORT` | OPTIONAL | `18080` | Railway/container port |
| `DATABASE_URL` | **REQUIRED** prod | lokal PG | Default parollar prod’da bloklanadi |
| `REDIS_URL` | **REQUIRED** prod | `redis://localhost:6379` | BullMQ, kesh, rate limit |
| `REDIS_SENTINEL_HOSTS` | OPTIONAL | — | HA: `host:26379,...` |
| `REDIS_SENTINEL_MASTER_NAME` | OPTIONAL | — | Sentinel master nomi |
| `JWT_ACCESS_SECRET` | **REQUIRED** prod | dev default | ≥32 belgi, `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **REQUIRED** prod | dev default | ≥32 belgi |
| `CORS_ALLOWED_ORIGINS` | **REQUIRED** prod | — | Vergul bilan origin ro‘yxati |
| `RBAC_ENFORCE_PERMISSIONS` | **REQUIRED** prod | `0` | Production: `1` majburiy |
| `INTERNAL_HEALTH_TOKEN` | **RECOMMENDED** prod | — | `/ready`, `/metrics` himoyasi (≥16 belgi) |
| `SENTRY_DSN` | OPTIONAL | — | Xato monitoring |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OPTIONAL | — | OpenTelemetry traces |
| `OTEL_SERVICE_NAME` | OPTIONAL | `salec-backend` | Trace service name |
| `LOG_SAMPLE_RATE` | OPTIONAL | `1.0` | 0.0–1.0 verbose log sampling |
| `STORAGE_ENDPOINT` | OPTIONAL | — | R2/S3 endpoint URL |
| `STORAGE_BUCKET` | OPTIONAL | — | Bucket nomi |
| `STORAGE_ACCESS_KEY` | OPTIONAL | — | Access key |
| `STORAGE_SECRET_KEY` | OPTIONAL | — | Secret key |
| `STORAGE_PUBLIC_BASE_URL` | OPTIONAL | — | CDN/public URL prefiks |
| `MULTIPART_MAX_FILE_BYTES` | OPTIONAL | 32MB | Global multipart limit |
| `MULTIPART_EXCEL_MAX_BYTES` | OPTIONAL | 25MB | Excel import limit |
| `MULTIPART_APK_MAX_BYTES` | OPTIONAL | 120MB | APK upload limit |
| `AUTH_LOGIN_RATE_MAX` | OPTIONAL | 30 | Login rate limit |
| `AUTH_LOGIN_RATE_WINDOW_MS` | OPTIONAL | 900000 | Login oyna (ms) |
| `WRITE_API_RATE_MAX` | OPTIONAL | 120 | Write API rate limit |
| `WRITE_API_RATE_WINDOW_MS` | OPTIONAL | 60000 | Write API oyna |
| `FCM_SERVER_KEY` | OPTIONAL | — | Push bildirishnomalar |
| `ACTIVITY_TRACKING_ENABLED` | OPTIONAL | `1` | User activity tracking |
| `ACTIVITY_RETENTION_DAYS` | OPTIONAL | 90 | Activity retention |
| `DASHBOARD_PERF_LOG` | OPTIONAL | `0` | Dashboard perf logging |
| `DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS` | OPTIONAL | 60 | Snapshot cache TTL |
| `DASHBOARD_CACHE_WARMING` | OPTIONAL | `0` | Proaktiv kesh isitish |

Namuna fayllar: `backend/.env.example`, `infrastructure/.env.production.example`.

## 2. Deploy oldidan

```bash
cd backend
npm run backup:pre-release    # Linux/macOS/WSL yoki pg-backup.ps1 (Windows)
npm run db:deploy             # migratsiyalar
npm run prod:verify           # to‘liq tekshiruv to‘plami
npm run build
```

## 3. Health endpoint tekshiruvi

### `/health` — ochiq uptime probe

```bash
curl -sS https://api.example.com/health | jq .
# Kutilgan: {"status":"ok","time":"..."}
```

### `/ready` — DB tayyorligi

Token yoqilgan bo‘lsa (`INTERNAL_HEALTH_TOKEN`):

```bash
curl -sS -H "x-internal-token: YOUR_TOKEN" https://api.example.com/ready | jq .
# 200: {"status":"ready",...}  |  503: NotReady
```

Token yo‘q bo‘lsa (dev):

```bash
curl -sS http://127.0.0.1:18080/ready | jq .
```

### `/metrics` — Prometheus

Production (token majburiy):

```bash
curl -sS -H "x-internal-token: YOUR_TOKEN" https://api.example.com/metrics | head
# Kutilgan: http_requests_total, process_cpu_user_seconds_total, ...
```

Dev (token talab qilinmaydi):

```bash
curl -sS http://127.0.0.1:18080/metrics | head
```

## 4. Xavfsizlik checklist

- [ ] `RBAC_ENFORCE_PERMISSIONS=1`
- [ ] `CORS_ALLOWED_ORIGINS` aniq ro‘yxat (wildcard yo‘q)
- [ ] JWT secretlar unique va ≥32 belgi
- [ ] `INTERNAL_HEALTH_TOKEN` o‘rnatilgan
- [ ] Backup bajarilgan (`npm run backup:pre-release`)
- [ ] Refresh token HttpOnly cookie (web) — `docs/AUTH_TOKEN_STRATEGY.md`

## 5. Post-deploy smoke

```bash
cd backend && npm run prod:ops-check
curl -f https://api.example.com/health
curl -f -H "x-internal-token: $INTERNAL_HEALTH_TOKEN" https://api.example.com/ready
```

## 6. Rollback

1. Oldingi Docker image / Railway deploy
2. `gunzip -c backups/postgres/salec_*.sql.gz | psql "$DATABASE_URL"`
3. `npm run db:deploy`

Batafsil: `docs/BACKUP_AND_DR.md`, `docs/RAILWAY-DEPLOY.md`.
