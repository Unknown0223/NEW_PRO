-- Soft-supersede for order status rollback (keep history instead of deleteMany).
ALTER TABLE "order_status_logs" ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "order_status_logs_order_id_superseded_at_idx"
  ON "order_status_logs"("order_id", "superseded_at");
