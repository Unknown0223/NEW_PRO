-- Dashboard perf supporting indexes
-- Notes:
-- - IF NOT EXISTS keeps migration idempotent across environments.

-- Supervisor dashboard / "Итоги визитов": tenant + agent + day-range
CREATE INDEX IF NOT EXISTS "agent_visits_tenant_agent_checked_in_at_idx"
  ON "agent_visits" ("tenant_id", "agent_id", "checked_in_at" DESC);

-- Supervisor dashboard photo pairs: tenant + creator + day-range
CREATE INDEX IF NOT EXISTS "client_photo_reports_tenant_creator_created_at_idx"
  ON "client_photo_reports" ("tenant_id", "created_by_user_id", "created_at" DESC);

-- Finance dashboard payments: paid_at range + common filters
CREATE INDEX IF NOT EXISTS "client_payments_tenant_entry_kind_deleted_paid_at_idx"
  ON "client_payments" ("tenant_id", "entry_kind", "deleted_at", "paid_at" DESC);

CREATE INDEX IF NOT EXISTS "client_payments_tenant_paid_at_idx"
  ON "client_payments" ("tenant_id", "paid_at" DESC);

