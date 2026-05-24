-- Ta'minotchiga to'lov: kassa bog'lanishi, storno, idempotency
ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "cash_desk_id" INTEGER;
ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMPTZ;
ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "reversed_by_user_id" INTEGER;
ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_cash_desk_id_fkey'
  ) THEN
    ALTER TABLE "supplier_payments"
      ADD CONSTRAINT "supplier_payments_cash_desk_id_fkey"
      FOREIGN KEY ("cash_desk_id") REFERENCES "cash_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_reversed_by_user_id_fkey'
  ) THEN
    ALTER TABLE "supplier_payments"
      ADD CONSTRAINT "supplier_payments_reversed_by_user_id_fkey"
      FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "supplier_payments_tenant_cash_desk_idx" ON "supplier_payments" ("tenant_id", "cash_desk_id");
CREATE INDEX IF NOT EXISTS "supplier_payments_tenant_payment_method_idx" ON "supplier_payments" ("tenant_id", "payment_method");
CREATE INDEX IF NOT EXISTS "supplier_payments_tenant_created_at_idx" ON "supplier_payments" ("tenant_id", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_payments_tenant_idempotency_uidx"
  ON "supplier_payments" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
