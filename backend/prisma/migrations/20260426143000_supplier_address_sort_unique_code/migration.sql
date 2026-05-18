-- Supplier registry: address, sort order (unique (tenant_id, code) — Prisma schema @@unique)
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "address" VARCHAR(512);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_sort_order_idx" ON "suppliers" ("tenant_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenant_id_code_key" ON "suppliers" ("tenant_id", "code");
