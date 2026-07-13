-- Katalog code: UI ≤24, deactivate `__void_{id}` uchun VarChar(64) + is_active indexlar

ALTER TABLE "product_brands" ALTER COLUMN "code" TYPE VARCHAR(64);
ALTER TABLE "product_manufacturers" ALTER COLUMN "code" TYPE VARCHAR(64);
ALTER TABLE "product_segments" ALTER COLUMN "code" TYPE VARCHAR(64);
ALTER TABLE "product_catalog_groups" ALTER COLUMN "code" TYPE VARCHAR(64);
ALTER TABLE "interchangeable_product_groups" ALTER COLUMN "code" TYPE VARCHAR(64);
ALTER TABLE "product_categories" ALTER COLUMN "code" TYPE VARCHAR(64);

CREATE INDEX IF NOT EXISTS "product_brands_tenant_id_is_active_idx"
  ON "product_brands"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "product_manufacturers_tenant_id_is_active_idx"
  ON "product_manufacturers"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "product_segments_tenant_id_is_active_idx"
  ON "product_segments"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "product_catalog_groups_tenant_id_is_active_idx"
  ON "product_catalog_groups"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "interchangeable_product_groups_tenant_id_is_active_idx"
  ON "interchangeable_product_groups"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "product_categories_tenant_id_is_active_idx"
  ON "product_categories"("tenant_id", "is_active");
