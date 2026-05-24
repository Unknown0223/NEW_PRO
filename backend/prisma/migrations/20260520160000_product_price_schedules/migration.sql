-- CreateTable
CREATE TABLE "product_price_schedules" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "price_type" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "effective_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "created_by" INTEGER,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_price_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_price_schedules_tenant_id_status_effective_at_idx" ON "product_price_schedules"("tenant_id", "status", "effective_at");

-- CreateIndex
CREATE INDEX "product_price_schedules_tenant_id_product_id_price_type_stat_idx" ON "product_price_schedules"("tenant_id", "product_id", "price_type", "status");

-- AddForeignKey
ALTER TABLE "product_price_schedules" ADD CONSTRAINT "product_price_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_schedules" ADD CONSTRAINT "product_price_schedules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
