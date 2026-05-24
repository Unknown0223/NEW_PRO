CREATE TABLE IF NOT EXISTS "client_qr_codes" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "qr_code" VARCHAR(128) NOT NULL,
  "client_id" INTEGER REFERENCES "clients"("id") ON DELETE SET NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'new',
  "created_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "printed_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "bound_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "detached_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "printed_at" TIMESTAMP(3),
  "bound_at" TIMESTAMP(3),
  "detached_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "client_qr_codes_tenant_qr_unique" UNIQUE ("tenant_id", "qr_code")
);

CREATE INDEX IF NOT EXISTS "client_qr_codes_tenant_status_idx"
  ON "client_qr_codes"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "client_qr_codes_tenant_client_idx"
  ON "client_qr_codes"("tenant_id", "client_id");
CREATE INDEX IF NOT EXISTS "client_qr_codes_tenant_created_idx"
  ON "client_qr_codes"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "client_qr_codes_tenant_bound_idx"
  ON "client_qr_codes"("tenant_id", "bound_at" DESC);
CREATE INDEX IF NOT EXISTS "client_qr_codes_qr_code_idx"
  ON "client_qr_codes"("qr_code");

