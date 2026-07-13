-- Client saved duplicate groups: soft-void o‘rniga hard delete.
ALTER TABLE "client_saved_duplicate_groups" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "client_saved_duplicate_groups" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_saved_duplicate_groups_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "client_saved_duplicate_groups"
      ADD CONSTRAINT "client_saved_duplicate_groups_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "client_saved_duplicate_groups_tenant_id_deleted_at_idx"
  ON "client_saved_duplicate_groups"("tenant_id", "deleted_at");
