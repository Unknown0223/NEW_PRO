-- EXPLAIN: orders list (tenant + sort + limit) — `listOrdersPaged` ning soddalashtirilgan patterni
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-orders-list-paged.sql
-- tenant_id va sanalarni o‘zgartiring. To‘liq filterlar `orders.service.ts` → `listOrdersPaged`.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id,
       o.status,
       o.created_at,
       o.client_id,
       o.agent_id
FROM orders o
WHERE o.tenant_id = 1
  AND o.order_type = 'order'
  AND o.created_at >= '2026-01-01T00:00:00.000Z'::timestamptz
  AND o.created_at <= '2026-01-31T23:59:59.999Z'::timestamptz
ORDER BY o.created_at DESC
LIMIT 50;
