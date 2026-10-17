ALTER TABLE "payroll_formulas" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "payroll_formulas" ADD COLUMN IF NOT EXISTS "month" INTEGER;
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_year_month_idx" ON "payroll_formulas"("tenant_id", "year", "month");
