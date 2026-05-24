-- Dashboard supervisor filtri: orderScopeSql / visitScopeSql ichida `u.supervisor_user_id IN (...)`
-- Query owner: `dashboard.service.ts` → getSupervisorDashboardSnapshot, getSalesDashboardSnapshot (agent join).
--
-- Tarix: indeks 20260402160000 da yaratilgan, 20260404043925 (goods_receipts) da DROP qilingan — qayta tiklanadi.
-- Rollback: DROP INDEX IF EXISTS "users_tenant_supervisor_user_id_idx";

CREATE INDEX IF NOT EXISTS "users_tenant_supervisor_user_id_idx"
  ON "users" ("tenant_id", "supervisor_user_id")
  WHERE "supervisor_user_id" IS NOT NULL;

-- Dashboard client filtrlari: category, zone, region, city (btrim + IN ro‘yxatlari)
-- Rollback: DROP INDEX IF EXISTS "clients_tenant_dashboard_dims_idx";

CREATE INDEX IF NOT EXISTS "clients_tenant_dashboard_dims_idx"
  ON "clients" ("tenant_id", "category", "zone", "region", "city");
