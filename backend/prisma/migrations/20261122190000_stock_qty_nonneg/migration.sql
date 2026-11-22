-- Fizik qty manfiy bo‘lmasin (reserved_qty nonneg bilan bir xil himoya)
UPDATE "stock" SET "qty" = 0 WHERE "qty" < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_qty_nonneg'
  ) THEN
    ALTER TABLE "stock" ADD CONSTRAINT stock_qty_nonneg CHECK ("qty" >= 0);
  END IF;
END $$;
