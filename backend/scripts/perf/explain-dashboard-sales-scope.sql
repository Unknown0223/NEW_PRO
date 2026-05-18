-- EXPLAIN: sales dashboard pattern (orders + order_items + users + clients)
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-dashboard-sales-scope.sql
-- Iltimos: tenant_id va sanalarni o‘zgartiring.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COALESCE(SUM(oi.total), 0)::numeric(15, 2) AS sales_sum,
  COUNT(DISTINCT o.id)::bigint AS orders_count
FROM orders o
JOIN users u ON u.id = o.agent_id
JOIN clients c ON c.id = o.client_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.tenant_id = 1
  AND o.order_type = 'order'
  AND o.created_at >= '2026-01-01T00:00:00.000Z'::timestamptz
  AND o.created_at <= '2026-01-31T23:59:59.999Z'::timestamptz
  AND o.status NOT IN ('cancelled', 'returned');
