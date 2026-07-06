ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "bonus_alert" VARCHAR(32);

CREATE INDEX IF NOT EXISTS "orders_tenant_bonus_alert_idx"
  ON "orders" ("tenant_id", "bonus_alert")
  WHERE "bonus_alert" IS NOT NULL;
