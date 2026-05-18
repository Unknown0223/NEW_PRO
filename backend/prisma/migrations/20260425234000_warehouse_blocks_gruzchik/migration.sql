-- Warehouse blocks: gruzchik biriktirish (kim yig‘ishni bajaradi)
ALTER TABLE "warehouse_blocks"
  ADD COLUMN "gruzchik_user_id" INTEGER;

CREATE INDEX "warehouse_blocks_gruzchik_user_id_idx"
  ON "warehouse_blocks"("gruzchik_user_id");

ALTER TABLE "warehouse_blocks"
  ADD CONSTRAINT "warehouse_blocks_gruzchik_user_id_fkey"
  FOREIGN KEY ("gruzchik_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
