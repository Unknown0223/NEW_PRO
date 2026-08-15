-- Client: consignment order gates
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "allow_consignment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "allow_consignment_with_debt" BOOLEAN NOT NULL DEFAULT true;
