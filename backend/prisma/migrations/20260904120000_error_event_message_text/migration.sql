-- Error journal: allow full messages (not truncated at 500 chars).
ALTER TABLE "error_events" ALTER COLUMN "message" SET DATA TYPE TEXT;
