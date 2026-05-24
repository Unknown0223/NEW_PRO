-- EXPLAIN: GET /api/:slug/reports/sales (getSalesSummary asosiy agregat)
-- Ishlatish: psql $DATABASE_URL -v ON_ERROR_STOP=1 -f explain-reports-sales.sql

-- psql: \set tenant_id 1  \set date_from '2026-01-01'  \set date_to '2026-12-31'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COUNT(*)::bigint AS order_count,
  COALESCE(SUM(o.total_sum), 0)::numeric AS total_sum
FROM orders o
WHERE o.tenant_id = 1
  AND o.created_at >= TIMESTAMPTZ '2026-01-01'
  AND o.created_at <= TIMESTAMPTZ '2026-12-31 23:59:59.999'
  AND o.status NOT IN ('cancelled', 'draft');
