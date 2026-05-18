-- Retail outlet stock snapshots
CREATE TABLE "retail_outlet_stocks" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "stock_date" DATE NOT NULL,
  "client_id" INTEGER NOT NULL,
  "product_id" INTEGER NOT NULL,
  "agent_id" INTEGER,
  "territory_1" VARCHAR(128),
  "territory_2" VARCHAR(128),
  "territory_3" VARCHAR(128),
  "quantity" DECIMAL(15,3) NOT NULL,
  "sold_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "amount" DECIMAL(15,2),
  "price_type" VARCHAR(64),
  "volume" VARCHAR(64),
  "comment" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "retail_outlet_stocks"
  ADD CONSTRAINT "retail_outlet_stocks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_outlet_stocks"
  ADD CONSTRAINT "retail_outlet_stocks_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_outlet_stocks"
  ADD CONSTRAINT "retail_outlet_stocks_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "retail_outlet_stocks_tenant_date_client_product_uq"
  ON "retail_outlet_stocks" ("tenant_id", "stock_date", "client_id", "product_id");
CREATE INDEX "retail_outlet_stocks_tenant_date_idx"
  ON "retail_outlet_stocks" ("tenant_id", "stock_date");
CREATE INDEX "retail_outlet_stocks_tenant_agent_idx"
  ON "retail_outlet_stocks" ("tenant_id", "agent_id");
CREATE INDEX "retail_outlet_stocks_tenant_territory_idx"
  ON "retail_outlet_stocks" ("tenant_id", "territory_1", "territory_2", "territory_3");
CREATE INDEX "retail_outlet_stocks_tenant_product_idx"
  ON "retail_outlet_stocks" ("tenant_id", "product_id");

-- Upload audit
CREATE TABLE "stock_uploads" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "uploaded_by_user_id" INTEGER,
  "file_name" VARCHAR(512) NOT NULL,
  "rows_total" INTEGER NOT NULL DEFAULT 0,
  "rows_applied" INTEGER NOT NULL DEFAULT 0,
  "errors_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "stock_uploads"
  ADD CONSTRAINT "stock_uploads_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "stock_uploads_tenant_created_idx"
  ON "stock_uploads" ("tenant_id", "created_at" DESC);
