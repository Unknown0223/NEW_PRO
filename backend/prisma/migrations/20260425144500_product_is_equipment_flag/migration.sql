-- Products: mark items that should be used in client equipment module.
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "is_equipment" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "products_tenant_id_is_equipment_idx"
ON "products"("tenant_id", "is_equipment");
