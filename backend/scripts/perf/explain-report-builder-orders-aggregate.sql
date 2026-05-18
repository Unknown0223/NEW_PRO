-- EXPLAIN: report-builder tipik agregat (orders + order_items, tenant + sana)
-- POST /api/:slug/reports/report-builder/dataset — dinamik SQL; bu namuna profiling uchun.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  o.agent_id,
  COUNT(DISTINCT o.id)::bigint AS order_count,
  COALESCE(SUM(oi.total), 0)::numeric AS line_sum
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.tenant_id = 1
  AND o.created_at >= TIMESTAMPTZ '2026-01-01'
  AND o.created_at <= TIMESTAMPTZ '2026-12-31 23:59:59.999'
  AND o.status NOT IN ('cancelled', 'draft')
GROUP BY o.agent_id
ORDER BY line_sum DESC
LIMIT 50;
