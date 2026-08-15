-- Report builder saved configs: soft-void o‘rniga hard delete.
ALTER TABLE "report_builder_saved_configs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "report_builder_saved_configs" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_builder_saved_configs_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "report_builder_saved_configs"
      ADD CONSTRAINT "report_builder_saved_configs_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "report_builder_saved_configs_tenant_id_deleted_at_idx"
  ON "report_builder_saved_configs"("tenant_id", "deleted_at");
