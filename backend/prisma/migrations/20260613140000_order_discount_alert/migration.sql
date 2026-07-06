ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_alert" VARCHAR(32);

CREATE INDEX IF NOT EXISTS "orders_tenant_discount_alert_idx"
  ON "orders" ("tenant_id", "discount_alert")
  WHERE "discount_alert" IS NOT NULL;
