-- EXPLAIN: stock balances (summary view) — `listStockBalances` → `fetchRawBalanceLines`
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-stock-balances-summary.sql
--
-- Eslatma: API barcha mos `stock` qatorlarini yuklab, keyin Node.js da product bo‘yicha agregatlaydi.
-- Katta tenantlarda `warehouse_id IN (...)` + `products` filtri va indekslar muhim.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT s.product_id,
       s.warehouse_id,
       s.qty,
       s.reserved_qty
FROM stock s
INNER JOIN products p ON p.id = s.product_id
WHERE s.tenant_id = 1
  AND s.warehouse_id IN (SELECT id FROM warehouses WHERE tenant_id = 1 AND is_active = true LIMIT 50)
  AND p.is_active = true;
