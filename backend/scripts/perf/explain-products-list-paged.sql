-- EXPLAIN: products list — `GET /api/:slug/products` (tenant + filter + sort + limit)
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-products-list-paged.sql
-- To‘liq filterlar: `contracts/products.schemas.ts` → `parseProductsListQuery`.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id,
       p.sku,
       p.name,
       p.is_active,
       p.category_id
FROM products p
WHERE p.tenant_id = 1
  AND p.is_active = true
ORDER BY p.sort_order ASC NULLS LAST, p.name ASC, p.id ASC
LIMIT 20;
