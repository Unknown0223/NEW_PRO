ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source_created_by" VARCHAR(200);
ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "source_created_by" VARCHAR(200);
