CREATE TABLE IF NOT EXISTS "payroll_grid_months" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "scope" VARCHAR(8) NOT NULL,
  "role" VARCHAR(64) NOT NULL DEFAULT '',
  "user_id" INTEGER NOT NULL DEFAULT 0,
  "base_amount" DECIMAL(15,2),
  "item_amounts" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_grid_months_uq" ON "payroll_grid_months"("tenant_id", "year", "month", "scope", "role", "user_id");
CREATE INDEX IF NOT EXISTS "payroll_grid_months_tenant_id_year_month_idx" ON "payroll_grid_months"("tenant_id", "year", "month");
