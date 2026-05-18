-- Kunlik valyuta kurslari (tenant bo'yicha)
CREATE TABLE "currency_exchange_rates" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "rate_date" DATE NOT NULL,
    "base_currency" VARCHAR(8) NOT NULL,
    "quote_currency" VARCHAR(8) NOT NULL,
    "rate" DECIMAL(20,8) NOT NULL,
    "source" VARCHAR(64),
    "note" VARCHAR(500),
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "currency_exchange_rates_tenant_id_rate_date_base_currency_quote_currency_key" ON "currency_exchange_rates" ("tenant_id", "rate_date", "base_currency", "quote_currency");

CREATE INDEX "currency_exchange_rates_tenant_id_rate_date_idx" ON "currency_exchange_rates" ("tenant_id", "rate_date" DESC);

ALTER TABLE "currency_exchange_rates" ADD CONSTRAINT "currency_exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
