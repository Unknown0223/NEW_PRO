-- Foundation Sprint 3: clients ro‘yxati (tenant + active + name) va references (merged emas).
-- Rollback:
--   DROP INDEX IF EXISTS clients_tenant_active_name_idx;
--   DROP INDEX IF EXISTS clients_tenant_not_merged_idx;

CREATE INDEX IF NOT EXISTS clients_tenant_active_name_idx
  ON clients (tenant_id, is_active, name);

CREATE INDEX IF NOT EXISTS clients_tenant_not_merged_idx
  ON clients (tenant_id)
  WHERE merged_into_client_id IS NULL;
