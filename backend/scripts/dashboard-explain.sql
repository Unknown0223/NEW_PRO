-- Staging: EXPLAIN (ANALYZE, BUFFERS) for dashboard hot paths.
-- Replace :tenant_id, :from, :to with real values.

-- 1) Sales-monitoring SKU aggregate (simplified)
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, COALESCE(SUM(oi.total), 0) AS total_sum
FROM orders o
JOIN users u ON u.id = o.agent_id
JOIN clients c ON c.id = o.client_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.tenant_id = :tenant_id
  AND o.order_type = 'sale'
  AND o.created_at >= :from
  AND o.created_at < :to
GROUP BY p.id
HAVING COALESCE(SUM(oi.total), 0) > 0
ORDER BY total_sum DESC
LIMIT 50;

-- 2) Finance receivable / debt by client (simplified)
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.client_id, SUM(GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)) AS debt
FROM orders o
LEFT JOIN (
  SELECT pa.order_id, SUM(pa.amount) AS allocated
  FROM payment_allocations pa
  WHERE pa.tenant_id = :tenant_id
  GROUP BY pa.order_id
) a ON a.order_id = o.id
WHERE o.tenant_id = :tenant_id
  AND o.status IN ('delivered', 'returned')
GROUP BY o.client_id;

-- 3) Orders tenant + type + created_at (index check)
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM orders o
WHERE o.tenant_id = :tenant_id
  AND o.order_type = 'sale'
  AND o.created_at >= :from
  AND o.created_at < :to;
