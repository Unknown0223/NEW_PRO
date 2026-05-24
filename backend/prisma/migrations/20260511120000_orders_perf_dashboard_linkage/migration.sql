-- Dashboard (sales / monitoring) va supervisor kunlik orderScope: tenant + type + vaqt + agent
-- Mavjud: @@index([tenant_id, order_type, created_at(sort: Desc)]) — agent filtri bilan birga ishlash uchun kengaytirilgan indeks.
CREATE INDEX IF NOT EXISTS "orders_tenant_order_type_agent_created_at_idx"
  ON "orders" ("tenant_id", "order_type", "agent_id", "created_at" DESC);

-- order_items: mahsulot bo‘yicha EXISTS / filtrlash (sales product filters)
CREATE INDEX IF NOT EXISTS "order_items_product_id_order_id_idx"
  ON "order_items" ("product_id", "order_id");

-- GET /agents, /expeditors: tenant + rol + faollik
CREATE INDEX IF NOT EXISTS "users_tenant_role_active_idx"
  ON "users" ("tenant_id", "role", "is_active")
  WHERE "is_active" = true;
