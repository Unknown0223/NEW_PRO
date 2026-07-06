ALTER TABLE "cash_desks"
  ADD COLUMN IF NOT EXISTS "accepts_client_payments" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "accepts_discount_payments" BOOLEAN NOT NULL DEFAULT true;
