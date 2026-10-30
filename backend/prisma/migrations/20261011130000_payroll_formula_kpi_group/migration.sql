ALTER TABLE "payroll_formulas" ADD COLUMN IF NOT EXISTS "kpi_group_id" INTEGER;
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_kpi_group_id_idx" ON "payroll_formulas"("tenant_id", "kpi_group_id");
