-- Order automation rules: soft-void o‘rniga hard delete.
ALTER TABLE "order_restriction_rules" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "order_restriction_rules" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;
ALTER TABLE "order_auto_confirm_rules" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "order_auto_confirm_rules" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_restriction_rules_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "order_restriction_rules"
      ADD CONSTRAINT "order_restriction_rules_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_auto_confirm_rules_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "order_auto_confirm_rules"
      ADD CONSTRAINT "order_auto_confirm_rules_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_restriction_rules_tenant_id_deleted_at_idx"
  ON "order_restriction_rules"("tenant_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "order_auto_confirm_rules_tenant_id_deleted_at_idx"
  ON "order_auto_confirm_rules"("tenant_id", "deleted_at");
