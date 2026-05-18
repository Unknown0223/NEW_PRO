-- Performance indexes (dashboard, payments FIFO, product catalog, audit)

CREATE INDEX IF NOT EXISTS "products_tenant_id_is_active_idx" ON "products"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "products_tenant_id_barcode_idx" ON "products"("tenant_id", "barcode");

CREATE INDEX IF NOT EXISTS "orders_tenant_id_agent_id_status_idx" ON "orders"("tenant_id", "agent_id", "status");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_client_id_status_idx" ON "orders"("tenant_id", "client_id", "status");

CREATE INDEX IF NOT EXISTS "client_balances_tenant_id_balance_idx" ON "client_balances"("tenant_id", "balance");

CREATE INDEX IF NOT EXISTS "client_audit_logs_tenant_id_client_id_action_idx" ON "client_audit_logs"("tenant_id", "client_id", "action");

CREATE INDEX IF NOT EXISTS "client_payments_tenant_id_client_id_entry_kind_idx" ON "client_payments"("tenant_id", "client_id", "entry_kind");
