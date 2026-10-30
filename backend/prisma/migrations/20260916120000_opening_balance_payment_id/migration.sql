-- Link opening-balance entries to the ledger payment they create (reliable void/restore).
ALTER TABLE "client_opening_balance_entries"
  ADD COLUMN IF NOT EXISTS "payment_id" INTEGER;

CREATE INDEX IF NOT EXISTS "client_opening_balance_entries_tenant_id_payment_id_idx"
  ON "client_opening_balance_entries"("tenant_id", "payment_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_opening_balance_entries_payment_id_fkey'
  ) THEN
    ALTER TABLE "client_opening_balance_entries"
      ADD CONSTRAINT "client_opening_balance_entries_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "client_payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill from ledger notes: "начальный баланс #<id>"
UPDATE "client_opening_balance_entries" e
SET "payment_id" = p.id
FROM "client_payments" p
WHERE e."payment_id" IS NULL
  AND p."tenant_id" = e."tenant_id"
  AND p."client_id" = e."client_id"
  AND p."note" IS NOT NULL
  AND lower(p."note") ~ ('начальный баланс #' || e."id"::text || '([^0-9]|$)');
