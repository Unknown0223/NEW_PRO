-- Warehouse zoning: blocks per warehouse + expeditor assignments

CREATE TABLE "warehouse_blocks" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "code" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "comment" VARCHAR(2000),
    "empty_stock_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouse_block_expeditors" (
    "block_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "warehouse_block_expeditors_pkey" PRIMARY KEY ("block_id","user_id")
);

CREATE INDEX "warehouse_blocks_tenant_id_warehouse_id_idx" ON "warehouse_blocks"("tenant_id", "warehouse_id");
CREATE INDEX "warehouse_blocks_tenant_id_is_active_idx" ON "warehouse_blocks"("tenant_id", "is_active");
CREATE INDEX "warehouse_block_expeditors_user_id_idx" ON "warehouse_block_expeditors"("user_id");

ALTER TABLE "warehouse_blocks" ADD CONSTRAINT "warehouse_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_blocks" ADD CONSTRAINT "warehouse_blocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_block_expeditors" ADD CONSTRAINT "warehouse_block_expeditors_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "warehouse_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_block_expeditors" ADD CONSTRAINT "warehouse_block_expeditors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
