-- Offline/retry: sales_returns.client_uuid
ALTER TABLE "sales_returns" ADD COLUMN IF NOT EXISTS "client_uuid" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "sales_returns_tenant_id_client_uuid_key"
  ON "sales_returns" ("tenant_id", "client_uuid");
