-- EXPLAIN: agent katalogi — sotilgan mahsulotlar (linkage.resolveByAgent SQL bilan bir xil mantiq)
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-linkage-agent-sold-products.sql
-- :tenant_id va :agent_id ni o‘zgartiring.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT oi.product_id AS product_id
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
WHERE o.tenant_id = 1
  AND o.agent_id = 1
  AND o.order_type = 'order'
  AND o.status <> 'cancelled'
  AND oi.is_bonus = false
  AND oi.product_id IS NOT NULL
GROUP BY oi.product_id
LIMIT 8000;
-- Backend: LIMIT `LINKAGE_AGENT_SOLD_PRODUCT_IDS_LIMIT` (.env) bilan moslashadi.
