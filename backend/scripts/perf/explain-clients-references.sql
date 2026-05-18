-- EXPLAIN: GET /api/:slug/clients/references — barcha mijozlardan distinct maydonlar (merged emas).
-- `getClientReferences` → findMany tenant_id + merged_into_client_id IS NULL.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  category,
  client_type_code,
  region,
  district,
  city,
  neighborhood,
  zone,
  client_format,
  sales_channel,
  product_category_ref,
  logistics_service
FROM clients
WHERE tenant_id = 1
  AND merged_into_client_id IS NULL;
