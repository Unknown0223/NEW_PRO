-- Mahsulot: rasm, qadoqlash, segment va savdo yo'nalishi bog'lanishlari

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

CREATE TABLE IF NOT EXISTS "product_packagings" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "width_cm" DECIMAL(12,2),
    "height_cm" DECIMAL(12,2),
    "length_cm" DECIMAL(12,2),
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_packagings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_segment_links" (
    "product_id" INTEGER NOT NULL,
    "segment_id" INTEGER NOT NULL,

    CONSTRAINT "product_segment_links_pkey" PRIMARY KEY ("product_id","segment_id")
);

CREATE TABLE IF NOT EXISTS "product_trade_direction_links" (
    "product_id" INTEGER NOT NULL,
    "trade_direction_id" INTEGER NOT NULL,

    CONSTRAINT "product_trade_direction_links_pkey" PRIMARY KEY ("product_id","trade_direction_id")
);

CREATE INDEX IF NOT EXISTS "product_packagings_tenant_id_product_id_idx" ON "product_packagings"("tenant_id", "product_id");
CREATE INDEX IF NOT EXISTS "product_segment_links_segment_id_idx" ON "product_segment_links"("segment_id");
CREATE INDEX IF NOT EXISTS "product_trade_direction_links_trade_direction_id_idx" ON "product_trade_direction_links"("trade_direction_id");

ALTER TABLE "product_packagings" DROP CONSTRAINT IF EXISTS "product_packagings_tenant_id_fkey";
ALTER TABLE "product_packagings" ADD CONSTRAINT "product_packagings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_packagings" DROP CONSTRAINT IF EXISTS "product_packagings_product_id_fkey";
ALTER TABLE "product_packagings" ADD CONSTRAINT "product_packagings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_segment_links" DROP CONSTRAINT IF EXISTS "product_segment_links_product_id_fkey";
ALTER TABLE "product_segment_links" ADD CONSTRAINT "product_segment_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_segment_links" DROP CONSTRAINT IF EXISTS "product_segment_links_segment_id_fkey";
ALTER TABLE "product_segment_links" ADD CONSTRAINT "product_segment_links_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "product_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_trade_direction_links" DROP CONSTRAINT IF EXISTS "product_trade_direction_links_product_id_fkey";
ALTER TABLE "product_trade_direction_links" ADD CONSTRAINT "product_trade_direction_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_trade_direction_links" DROP CONSTRAINT IF EXISTS "product_trade_direction_links_trade_direction_id_fkey";
ALTER TABLE "product_trade_direction_links" ADD CONSTRAINT "product_trade_direction_links_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "trade_directions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
