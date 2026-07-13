# Database scaling plan

## Read replica

### Maqsad

Hisobotlar (`reports/*`), dashboard snapshot va og‘ir `listOrdersPaged` so‘rovlari primary DB yukini kamaytirish.

### Bosqichlar

1. **Railway / managed Postgres** — read replica qo‘shish (staging sinov).
2. Env: `DATABASE_READ_URL` (ixtiyoriy) — bo‘lmasa `DATABASE_URL` ishlatiladi.
3. Kod: `prisma.$extends` yoki `withReadReplica()` helper — faqat read-only servislar.
4. Ustuvor modullar: `reports/`, `dashboard/`, `order.query.list.ts`.

### Monitoring

```sql
-- PostgreSQL: sekin so‘rovlar (production)
ALTER SYSTEM SET log_min_duration_statement = '500ms';
```

Log tahlili: `backend/scripts/perf/` va Grafana Loki.

## Index audit

| Jadval | Indeks | Sabab |
|--------|--------|-------|
| `orders` | `(tenant_id, created_at DESC)` | Ro‘yxat filtri |
| `tenant_audit_events` | `(tenant_id, created_at)` | Audit retention |
| `payments` | `(tenant_id, workflow_status)` | Pending to‘lovlar |

Har chorak: `EXPLAIN (ANALYZE, BUFFERS)` — `npm run perf:explain`.

## Partitioning (uzoq muddat)

Katta jadvallar uchun range partition (`created_at` oy bo‘yicha):

- `orders` — 12+ oy ma’lumot bo‘lganda
- `tenant_audit_events` — retention dan keyin arxiv partition

Hozir: reja; migratsiya alohida ADR.

## Connection pooling

- PgBouncer (Railway built-in yoki sidecar).
- Prisma: `connection_limit` env bilan moslash.
