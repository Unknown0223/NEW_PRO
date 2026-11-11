-- P1-9: offline/retry dublikat buyurtmani oldini olish
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "client_uuid" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_id_client_uuid_key"
  ON "orders" ("tenant_id", "client_uuid");
