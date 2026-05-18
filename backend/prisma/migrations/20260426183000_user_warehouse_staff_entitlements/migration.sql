-- Skladchik moduli: granular ruxsatlar (JSON)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "warehouse_staff_entitlements" JSONB NOT NULL DEFAULT '{}';
