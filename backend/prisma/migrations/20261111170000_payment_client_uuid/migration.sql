-- P1-9: to‘lov offline/retry dublikati
ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "client_uuid" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "client_payments_tenant_id_client_uuid_key"
  ON "client_payments" ("tenant_id", "client_uuid");
