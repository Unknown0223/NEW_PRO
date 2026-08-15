-- Zakazlar: konsignatsiyaga o‘tkazilgan vaqt / kim (Период → ro‘yxat filtr)
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "consignment_moved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consignment_moved_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_consignment_moved_by_user_id_fkey'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_consignment_moved_by_user_id_fkey"
      FOREIGN KEY ("consignment_moved_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "orders"
SET "consignment_moved_at" = "updated_at"
WHERE "is_consignment" = true
  AND "consignment_moved_at" IS NULL;

CREATE INDEX IF NOT EXISTS "orders_tenant_id_is_consignment_consignment_moved_at_idx"
  ON "orders" ("tenant_id", "is_consignment", "consignment_moved_at" DESC);
