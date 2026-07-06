# Cost management — SALEC

## Asosiy xarajat markazlari

| Komponent | Provider (misol) | Optimizatsiya |
|-----------|------------------|---------------|
| API + Worker | Railway | CPU/RAM right-sizing; worker alohida servis |
| PostgreSQL | Railway / Neon | Connection pool; indeks audit |
| Redis | Railway / Upstash | TTL; AOF faqat kerak bo‘lsa |
| Frontend | Railway / Vercel | `optimizePackageImports`; bundle analyze |
| Object storage | Cloudflare R2 | APK/foto — lokal disk o‘rniga R2 |
| Monitoring | Grafana Cloud free tier | Log sampling `LOG_SAMPLE_RATE` |

## Oylik tekshiruv

1. Railway usage dashboard
2. DB hajmi + backup retention (`BACKUP_RETENTION_DAYS`)
3. Redis memory
4. Egress (APK download, export)

## Billing alertlar (Railway)

Railway dashboard → **Account** → **Usage** → **Spending limit** / email notifications:

| Chegara | Harakat |
|---------|---------|
| **$50** | Email ogohlantirish — usage review (staging scale-down?) |
| **$100** | Email + Slack/Telegram (qo‘lda) — API/worker RAM audit, Redis plan |

**Oylik checklist (1-chi ish kuni):**

- [ ] Railway invoice / projected spend
- [ ] Postgres storage trend (oxirgi 30 kun)
- [ ] Redis memory peak
- [ ] GitHub Actions minutes (path filter ishlayaptimi?)
- [ ] R2/storage egress (APK download hajmi)

Agar $100 dan oshsa: worker alohida servisga ajratish yoki staging ni vaqtincha to‘xtatishni ko‘rib chiqing.

## Staging vs Production

- Staging: kichik Postgres/Redis plan, `workflow_dispatch` deploy
- Production: health/uptime monitoring, backup har release oldidan

## CI xarajati

GitHub Actions: `mobile.yml`, `ci.yml` — path filter bilan keraksiz runlarni kamaytiring.
