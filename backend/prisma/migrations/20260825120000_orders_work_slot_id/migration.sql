-- P1: yangi zakazlarda ishchi o‘rni snapshot (nullable — eski qatorlar null).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "work_slot_id" INTEGER;

CREATE INDEX IF NOT EXISTS "orders_work_slot_id_idx" ON "orders"("work_slot_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_work_slot_id_fkey'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_work_slot_id_fkey"
      FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
