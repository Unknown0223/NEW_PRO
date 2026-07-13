-- Currency exchange rates: soft-void + partial unique (faqat aktiv qatorlar).
ALTER TABLE "currency_exchange_rates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "currency_exchange_rates" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'currency_exchange_rates_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "currency_exchange_rates"
      ADD CONSTRAINT "currency_exchange_rates_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "currency_exchange_rates"
  DROP CONSTRAINT IF EXISTS "currency_exchange_rates_tenant_id_rate_date_base_currency_quote_currency_key";

CREATE UNIQUE INDEX IF NOT EXISTS "currency_exchange_rates_tenant_active_unique"
  ON "currency_exchange_rates"("tenant_id", "rate_date", "base_currency", "quote_currency")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "currency_exchange_rates_tenant_id_deleted_at_idx"
  ON "currency_exchange_rates"("tenant_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "currency_exchange_rates_tenant_id_rate_date_base_currency_quote_currency_idx"
  ON "currency_exchange_rates"("tenant_id", "rate_date", "base_currency", "quote_currency");
