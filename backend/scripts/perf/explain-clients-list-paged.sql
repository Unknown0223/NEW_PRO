-- EXPLAIN: clients list (tenant + sort + limit) — `listClientsForTenantPaged` ning soddalashtirilgan patterni
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f explain-clients-list-paged.sql
-- tenant_id va limitni o‘zgartiring. To‘liq filterlar `clients.service.ts` → `listClientsForTenantPaged`.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id,
       c.name,
       c.phone,
       c.created_at,
       c.is_active
FROM clients c
WHERE c.tenant_id = 1
  AND c.is_active = true
ORDER BY c.name ASC
LIMIT 50;
