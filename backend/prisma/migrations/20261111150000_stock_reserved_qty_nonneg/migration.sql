-- P1-7: reserved_qty manfiy bo‘lmasin (oversell himoya)
UPDATE "stock" SET "reserved_qty" = 0 WHERE "reserved_qty" < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_reserved_qty_nonneg'
  ) THEN
    ALTER TABLE "stock" ADD CONSTRAINT stock_reserved_qty_nonneg CHECK ("reserved_qty" >= 0);
  END IF;
END $$;
