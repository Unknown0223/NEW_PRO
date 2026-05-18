-- EXPLAIN: GET /api/:slug/reports/order-debts — `listOrderDebtsReport` base CTE (soddalashtirilgan).
-- To‘liq filtrlar URL query orqali; bu namuna tenant + receivable status.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH alloc AS (
  SELECT pa.order_id, SUM(pa.amount)::decimal(15, 2) AS sum_amt
  FROM payment_allocations pa
  WHERE pa.tenant_id = 1
  GROUP BY pa.order_id
),
ship AS (
  SELECT sl.order_id, MIN(sl.created_at) AS shipped_at
  FROM order_status_logs sl
  INNER JOIN orders ox ON ox.id = sl.order_id AND ox.tenant_id = 1
  WHERE sl.to_status IN ('delivering', 'delivered')
  GROUP BY sl.order_id
),
base AS (
  SELECT
    o.id,
    o.client_id,
    GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0)::decimal(15, 2) AS remainder
  FROM orders o
  INNER JOIN clients c ON c.id = o.client_id AND c.tenant_id = 1
  LEFT JOIN alloc a ON a.order_id = o.id
  LEFT JOIN ship ON ship.order_id = o.id
  WHERE o.tenant_id = 1
    AND o.order_type = 'order'
    AND o.status IN ('delivering', 'delivered')
    AND c.merged_into_client_id IS NULL
)
SELECT COUNT(*)::bigint AS total, COALESCE(SUM(remainder), 0)::decimal(15, 2) AS sum_remainder
FROM base
WHERE remainder > 0;
