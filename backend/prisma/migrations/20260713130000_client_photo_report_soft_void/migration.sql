-- Client photo reports: soft-void (arxiv) o‘rniga hard delete.
ALTER TABLE "client_photo_reports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "client_photo_reports" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_photo_reports_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "client_photo_reports"
      ADD CONSTRAINT "client_photo_reports_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "client_photo_reports_tenant_id_deleted_at_idx"
  ON "client_photo_reports"("tenant_id", "deleted_at");
