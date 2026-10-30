-- Optional document number for payments (any string id, e.g. ks_1652 / PAY-12)
ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "number" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "client_payments_tenant_id_number_key"
  ON "client_payments" ("tenant_id", "number");

CREATE INDEX IF NOT EXISTS "client_payments_tenant_id_number_idx"
  ON "client_payments" ("tenant_id", "number");
