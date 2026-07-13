-- Payment void: taqsimotlar snapshoti restore uchun.
ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "allocations_snapshot" JSONB;
