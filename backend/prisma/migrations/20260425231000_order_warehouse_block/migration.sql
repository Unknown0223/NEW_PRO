-- Zakazni yig‘ish/отгрузка uchun ombor blokiga bog‘lash (bitta доставщик maydoni).
ALTER TABLE "orders" ADD COLUMN "warehouse_block_id" INTEGER;

CREATE INDEX "orders_warehouse_block_id_idx" ON "orders"("warehouse_block_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_warehouse_block_id_fkey"
  FOREIGN KEY ("warehouse_block_id") REFERENCES "warehouse_blocks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
