-- Create race: bir zakaz bir vaqtda faqat bitta locked share qatoriga ega bo‘lsin.
CREATE UNIQUE INDEX IF NOT EXISTS "expeditor_share_orders_tenant_order_locked_uniq"
  ON "expeditor_share_orders" ("tenant_id", "order_id")
  WHERE "locked" = true;
