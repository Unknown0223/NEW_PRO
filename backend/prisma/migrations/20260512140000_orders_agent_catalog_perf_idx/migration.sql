-- Zakaz forma: agent bo‘yicha sotilgan mahsulotlar (order_items ↔ orders) tezroq
CREATE INDEX IF NOT EXISTS "orders_tenant_agent_order_type_idx"
  ON "orders" ("tenant_id", "agent_id", "order_type");
