-- Expeditor returns report: join sales_returns by tenant + order + status
CREATE INDEX IF NOT EXISTS "sales_returns_tenant_id_order_id_status_idx"
  ON "sales_returns" ("tenant_id", "order_id", "status");
