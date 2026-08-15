-- Inventarizatsiya: post paytida eski qoldiq snapshot (cancel/restore uchun).
ALTER TABLE "stock_take_lines" ADD COLUMN IF NOT EXISTS "previous_qty" DECIMAL(15,3);
