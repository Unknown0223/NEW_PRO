-- Work slots: soft-void (arxiv) o‘rniga hard delete.
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_slots_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "work_slots"
      ADD CONSTRAINT "work_slots_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "work_slots_tenant_id_deleted_at_idx"
  ON "work_slots"("tenant_id", "deleted_at");
