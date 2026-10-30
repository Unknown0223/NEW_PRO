ALTER TABLE "warehouse_transfers" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(24) NOT NULL DEFAULT 'warehouse';
