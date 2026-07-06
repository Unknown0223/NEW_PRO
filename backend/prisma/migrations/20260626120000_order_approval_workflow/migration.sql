-- Order approval workflow (plan approvers → buyurtma tasdiqlash zanjiri)

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(20);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "approval_step" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "approval_chain" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "orders_tenant_approval_status_idx"
  ON "orders" ("tenant_id", "approval_status")
  WHERE "approval_status" IS NOT NULL;
