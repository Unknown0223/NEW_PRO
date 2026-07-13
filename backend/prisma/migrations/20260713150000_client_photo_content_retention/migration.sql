-- Keep photo report rows (counts), purge heavy image payload after retention.
ALTER TABLE "client_photo_reports" ADD COLUMN IF NOT EXISTS "content_purged_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "client_photo_reports_content_purged_at_created_at_idx"
  ON "client_photo_reports"("content_purged_at", "created_at");
