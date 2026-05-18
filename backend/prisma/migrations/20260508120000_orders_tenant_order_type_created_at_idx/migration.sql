-- Dashboard / sales monitoring: date-range scans with order_type = 'order'
CREATE INDEX IF NOT EXISTS "orders_tenant_id_order_type_created_at_idx"
  ON "orders" ("tenant_id", "order_type", "created_at" DESC);
