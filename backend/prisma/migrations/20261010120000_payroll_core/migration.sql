-- ══════════════════════════════════════════════════════════════════════
-- ЗАРПЛАТА (payroll) core: formula, сетка, oylik hisob, to‘lovlar.
-- Model: backend/prisma/models/group-10.prisma
-- ══════════════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_formulas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(32),
    "kind" VARCHAR(32) NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kpi_group_id" INTEGER,
    "base_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "components" JSONB NOT NULL DEFAULT '[]',
    "gates" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_grids" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(32),
    "kpi_group_id" INTEGER,
    "metric" VARCHAR(32) NOT NULL DEFAULT 'kpi_percent',
    "mode" VARCHAR(16) NOT NULL DEFAULT 'coefficient',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_grids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_grid_rows" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "grid_id" INTEGER NOT NULL,
    "month" VARCHAR(7),
    "from_value" DECIMAL(18,4),
    "to_value" DECIMAL(18,4),
    "coefficient" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_grid_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_assignments" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "formula_id" INTEGER,
    "base_amount" DECIMAL(18,2),
    "comment" TEXT,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_periods" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "calculated_at" TIMESTAMP(3),
    "calculated_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "locked_at" TIMESTAMP(3),
    "locked_by" INTEGER,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_entries" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "formula_id" INTEGER,
    "kpi_group_id" INTEGER,
    "kind" VARCHAR(32) NOT NULL,
    "base_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "variable_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allowance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "worked_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "planned_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "achievement_percent" DECIMAL(8,2),
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "breakdown" JSONB NOT NULL DEFAULT '[]',
    "manual_net" DECIMAL(18,2),
    "status" VARCHAR(16) NOT NULL DEFAULT 'calculated',
    "comment" TEXT,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_payments" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "period_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" VARCHAR(16) NOT NULL DEFAULT 'cash',
    "cash_desk_id" INTEGER,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "created_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "voided_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_code_key" ON "payroll_formulas"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_is_active_idx" ON "payroll_formulas"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_kpi_group_id_idx" ON "payroll_formulas"("tenant_id", "kpi_group_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_grids_tenant_id_code_key" ON "payroll_grids"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "payroll_grids_tenant_id_is_active_idx" ON "payroll_grids"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "payroll_grids_tenant_id_kpi_group_id_idx" ON "payroll_grids"("tenant_id", "kpi_group_id");

CREATE INDEX IF NOT EXISTS "payroll_grid_rows_tenant_id_grid_id_month_idx" ON "payroll_grid_rows"("tenant_id", "grid_id", "month");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_assignments_tenant_id_user_id_key" ON "payroll_assignments"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "payroll_assignments_tenant_id_formula_id_idx" ON "payroll_assignments"("tenant_id", "formula_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_periods_tenant_id_month_key" ON "payroll_periods"("tenant_id", "month");
CREATE INDEX IF NOT EXISTS "payroll_periods_tenant_id_status_idx" ON "payroll_periods"("tenant_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_entries_period_id_user_id_key" ON "payroll_entries"("period_id", "user_id");
CREATE INDEX IF NOT EXISTS "payroll_entries_tenant_id_period_id_idx" ON "payroll_entries"("tenant_id", "period_id");
CREATE INDEX IF NOT EXISTS "payroll_entries_tenant_id_user_id_idx" ON "payroll_entries"("tenant_id", "user_id");

CREATE INDEX IF NOT EXISTS "payroll_payments_tenant_id_period_id_idx" ON "payroll_payments"("tenant_id", "period_id");
CREATE INDEX IF NOT EXISTS "payroll_payments_tenant_id_user_id_paid_at_idx" ON "payroll_payments"("tenant_id", "user_id", "paid_at");

-- AddForeignKey
ALTER TABLE "payroll_formulas" DROP CONSTRAINT IF EXISTS "payroll_formulas_tenant_id_fkey";
ALTER TABLE "payroll_formulas" ADD CONSTRAINT "payroll_formulas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_formulas" DROP CONSTRAINT IF EXISTS "payroll_formulas_kpi_group_id_fkey";
ALTER TABLE "payroll_formulas" ADD CONSTRAINT "payroll_formulas_kpi_group_id_fkey" FOREIGN KEY ("kpi_group_id") REFERENCES "kpi_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_grids" DROP CONSTRAINT IF EXISTS "payroll_grids_tenant_id_fkey";
ALTER TABLE "payroll_grids" ADD CONSTRAINT "payroll_grids_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_grids" DROP CONSTRAINT IF EXISTS "payroll_grids_kpi_group_id_fkey";
ALTER TABLE "payroll_grids" ADD CONSTRAINT "payroll_grids_kpi_group_id_fkey" FOREIGN KEY ("kpi_group_id") REFERENCES "kpi_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_grid_rows" DROP CONSTRAINT IF EXISTS "payroll_grid_rows_tenant_id_fkey";
ALTER TABLE "payroll_grid_rows" ADD CONSTRAINT "payroll_grid_rows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_grid_rows" DROP CONSTRAINT IF EXISTS "payroll_grid_rows_grid_id_fkey";
ALTER TABLE "payroll_grid_rows" ADD CONSTRAINT "payroll_grid_rows_grid_id_fkey" FOREIGN KEY ("grid_id") REFERENCES "payroll_grids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_assignments" DROP CONSTRAINT IF EXISTS "payroll_assignments_tenant_id_fkey";
ALTER TABLE "payroll_assignments" ADD CONSTRAINT "payroll_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_assignments" DROP CONSTRAINT IF EXISTS "payroll_assignments_user_id_fkey";
ALTER TABLE "payroll_assignments" ADD CONSTRAINT "payroll_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_assignments" DROP CONSTRAINT IF EXISTS "payroll_assignments_formula_id_fkey";
ALTER TABLE "payroll_assignments" ADD CONSTRAINT "payroll_assignments_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "payroll_formulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_periods" DROP CONSTRAINT IF EXISTS "payroll_periods_tenant_id_fkey";
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_tenant_id_fkey";
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_period_id_fkey";
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_user_id_fkey";
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_formula_id_fkey";
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "payroll_formulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_payments" DROP CONSTRAINT IF EXISTS "payroll_payments_tenant_id_fkey";
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_payments" DROP CONSTRAINT IF EXISTS "payroll_payments_period_id_fkey";
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_payments" DROP CONSTRAINT IF EXISTS "payroll_payments_user_id_fkey";
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
