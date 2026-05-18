-- EXPLAIN: supervisor dashboard kunlik orderScope (orders + users + clients, order_items yo‘q)
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-dashboard-supervisor-order-scope.sql
-- Query owner: dashboard.service.ts → orderScopeSql → getSupervisorDashboardSnapshot

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15, 2) AS s
FROM orders o
JOIN users u ON u.id = o.agent_id
JOIN clients c ON c.id = o.client_id
WHERE o.tenant_id = 1
  AND o.created_at >= '2026-05-01T00:00:00.000Z'::timestamptz
  AND o.created_at < '2026-05-02T00:00:00.000Z'::timestamptz
  AND o.order_type = 'order'
  AND o.status NOT IN ('cancelled', 'returned');
