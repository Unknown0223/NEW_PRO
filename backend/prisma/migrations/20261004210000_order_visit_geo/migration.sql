-- Mobil zakaz faqat vizit ichida: zakaz ↔ vizit bog‘lanishi va GPS tekshiruv natijasi.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "agent_visit_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "visit_geo" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_agent_visit_id_fkey') THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_agent_visit_id_fkey"
      FOREIGN KEY ("agent_visit_id") REFERENCES "agent_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orders_agent_visit_id_idx" ON "orders"("agent_visit_id");
