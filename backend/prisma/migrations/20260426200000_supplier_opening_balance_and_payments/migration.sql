-- Начальный баланс поставщика + платежи поставщикам
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "opening_balance_note" VARCHAR(2000);

CREATE TABLE IF NOT EXISTS "supplier_payments" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payment_method" VARCHAR(128),
  "comment" VARCHAR(2000),
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "supplier_payments_tenant_id_supplier_id_idx" ON "supplier_payments" ("tenant_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_payments_tenant_id_paid_at_idx" ON "supplier_payments" ("tenant_id", "paid_at" DESC);
