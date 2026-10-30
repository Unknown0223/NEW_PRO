-- Зарплата + Аванс moduli (payroll). Idempotent.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hired_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "cash_desk_id" INTEGER;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "employee_user_id" INTEGER;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(32) NOT NULL DEFAULT 'manual';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source_id" INTEGER;
CREATE INDEX IF NOT EXISTS "expenses_tenant_id_cash_desk_id_idx" ON "expenses"("tenant_id", "cash_desk_id");
CREATE INDEX IF NOT EXISTS "expenses_tenant_id_source_type_source_id_idx" ON "expenses"("tenant_id", "source_type", "source_id");
-- Bitta payout uchun bitta xarajat (dublikatga qarshi)
CREATE UNIQUE INDEX IF NOT EXISTS "expenses_payroll_source_uq" ON "expenses"("tenant_id", "source_type", "source_id")
  WHERE "source_type" <> 'manual' AND "source_id" IS NOT NULL AND "deleted_at" IS NULL;
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_settings" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "parallel_run" BOOLEAN NOT NULL DEFAULT false,
    "salary_queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_items" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(64),
    "type" VARCHAR(16) NOT NULL,
    "calc_type" VARCHAR(16) NOT NULL DEFAULT 'manual',
    "system_key" VARCHAR(32),
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "color" VARCHAR(16),
    "comment" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_role_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "base_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "allowance_item_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "deduction_item_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_role_configs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_employee_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "base_amount" DECIMAL(15,2),
    "cash_desk_id" INTEGER,
    "currency" VARCHAR(8),
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_employee_configs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_formulas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "scope" VARCHAR(16) NOT NULL DEFAULT 'common',
    "text" TEXT NOT NULL,
    "role" VARCHAR(64),
    "target_item_id" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_formulas_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_bonus_assignments" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kpi_group_id" INTEGER NOT NULL DEFAULT 0,
    "trade_direction_id" INTEGER NOT NULL DEFAULT 0,
    "formula_id" INTEGER NOT NULL,
    "formula_text_snapshot" TEXT NOT NULL,
    "target_item_id" INTEGER NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_bonus_assignments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_periods" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "closed_by" INTEGER,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_records" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "base_salary" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "plan_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "worked_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "allowances_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deductions_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advances_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paid_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "role" VARCHAR(64),
    "position" VARCHAR(160),
    "branch" VARCHAR(160),
    "trade_direction_id" INTEGER,
    "slot_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "employment_from" TIMESTAMP(3),
    "employment_to" TIMESTAMP(3),
    "calc_snapshot" JSONB NOT NULL DEFAULT '{}',
    "inputs_hash" VARCHAR(64),
    "frozen_inputs_hash" VARCHAR(64),
    "frozen_snapshot" JSONB,
    "dirty_at" TIMESTAMP(3),
    "dirty_reasons" JSONB NOT NULL DEFAULT '[]',
    "calculated_at" TIMESTAMP(3),
    "calc_error" VARCHAR(1000),
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "rejected_reason" VARCHAR(500),
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_record_lines" (
    "id" SERIAL NOT NULL,
    "record_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "source" VARCHAR(16) NOT NULL DEFAULT 'formula',
    "corr_key" VARCHAR(16) NOT NULL DEFAULT '',
    "formula_snapshot" TEXT,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "correction_for_year" INTEGER,
    "correction_for_month" INTEGER,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_record_lines_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_advances" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "created_by" INTEGER,
    "sent_by" INTEGER,
    "sent_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "branch_snapshot" VARCHAR(160),
    "queue_key" TIMESTAMP(3),
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "last_skipped_at" TIMESTAMP(3),
    "last_skipped_by" INTEGER,
    "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
    "import_batch_id" VARCHAR(64),
    "limit_exception_used" BOOLEAN NOT NULL DEFAULT false,
    "comment" VARCHAR(500),
    "payout_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_advances_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_advance_limits" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "scope_key" VARCHAR(96) NOT NULL,
    "role" VARCHAR(64),
    "user_id" INTEGER,
    "max_amount" DECIMAL(15,2) NOT NULL,
    "is_exception" BOOLEAN NOT NULL DEFAULT false,
    "comment" VARCHAR(500),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_advance_limits_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_payouts" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "record_id" INTEGER,
    "advance_id" INTEGER,
    "cash_desk_id" INTEGER NOT NULL,
    "payment_method_ref" VARCHAR(64),
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "rate_date" TIMESTAMP(3),
    "amount_uzs" DECIMAL(15,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_by" INTEGER,
    "status" VARCHAR(16) NOT NULL DEFAULT 'paid',
    "reversed_by" INTEGER,
    "reversed_at" TIMESTAMP(3),
    "reverse_reason" VARCHAR(500),
    "expense_id" INTEGER,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_payouts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_compare_batches" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "created_by" INTEGER,
    "signed_off_by" INTEGER,
    "signed_off_at" TIMESTAMP(3),
    "sign_off_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_compare_batches_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_settings_tenant_id_key" ON "payroll_settings"("tenant_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_items_tenant_id_type_is_active_idx" ON "payroll_items"("tenant_id", "type", "is_active");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_items_tenant_id_name_key" ON "payroll_items"("tenant_id", "name");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_role_configs_tenant_id_role_key" ON "payroll_role_configs"("tenant_id", "role");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_employee_configs_tenant_id_user_id_key" ON "payroll_employee_configs"("tenant_id", "user_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_is_active_idx" ON "payroll_formulas"("tenant_id", "is_active");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_formulas_tenant_id_role_idx" ON "payroll_formulas"("tenant_id", "role");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_bonus_assignments_tenant_id_year_month_idx" ON "payroll_bonus_assignments"("tenant_id", "year", "month");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_bonus_assignments_tenant_id_formula_id_idx" ON "payroll_bonus_assignments"("tenant_id", "formula_id");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_bonus_assignments_uq" ON "payroll_bonus_assignments"("tenant_id", "year", "month", "user_id", "kpi_group_id", "trade_direction_id", "target_item_id");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_periods_tenant_id_year_month_key" ON "payroll_periods"("tenant_id", "year", "month");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_records_tenant_id_year_month_status_idx" ON "payroll_records"("tenant_id", "year", "month", "status");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_records_tenant_id_dirty_at_idx" ON "payroll_records"("tenant_id", "dirty_at");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_records_tenant_id_user_id_year_month_key" ON "payroll_records"("tenant_id", "user_id", "year", "month");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_record_lines_record_id_item_id_corr_key_key" ON "payroll_record_lines"("record_id", "item_id", "corr_key");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_advances_tenant_id_status_queue_key_idx" ON "payroll_advances"("tenant_id", "status", "queue_key");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_advances_tenant_id_user_id_year_month_idx" ON "payroll_advances"("tenant_id", "user_id", "year", "month");
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_advance_limits_tenant_id_scope_key_key" ON "payroll_advance_limits"("tenant_id", "scope_key");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_payouts_tenant_id_user_id_year_month_idx" ON "payroll_payouts"("tenant_id", "user_id", "year", "month");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_payouts_tenant_id_cash_desk_id_status_idx" ON "payroll_payouts"("tenant_id", "cash_desk_id", "status");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_payouts_tenant_id_paid_at_idx" ON "payroll_payouts"("tenant_id", "paid_at");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_compare_batches_tenant_id_year_month_idx" ON "payroll_compare_batches"("tenant_id", "year", "month");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_record_lines_record_id_fkey') THEN
    ALTER TABLE "payroll_record_lines"
      ADD CONSTRAINT "payroll_record_lines_record_id_fkey"
      FOREIGN KEY ("record_id") REFERENCES "payroll_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Ishga olingan / bo'shatilgan sanalar: ishchi o'rni tarixidan
UPDATE "users" u
SET "hired_at" = COALESCE(s.first_start, u."created_at")
FROM (
  SELECT "user_id", MIN("started_at") AS first_start FROM "slot_user_links" GROUP BY "user_id"
) s
WHERE u."id" = s."user_id" AND u."hired_at" IS NULL;
UPDATE "users" u
SET "hired_at" = u."created_at"
WHERE u."hired_at" IS NULL;
UPDATE "users" u
SET "dismissed_at" = COALESCE(
  (SELECT MAX(l."ended_at") FROM "slot_user_links" l WHERE l."user_id" = u."id"),
  u."updated_at"
)
WHERE u."is_active" = false AND u."dismissed_at" IS NULL;
-- Tizim elementlari (o'chirilmaydi)
INSERT INTO "payroll_items" ("tenant_id", "name", "type", "calc_type", "system_key", "sort_order", "updated_at")
SELECT t."id", v.name, v.type, 'system', v.system_key, v.sort_order, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (VALUES
  ('Аванс', 'deduction', 'advance', 900),
  ('Корректировка', 'allowance', 'correction', 910),
  ('Qarzdorlik', 'deduction', 'carry', 920)
) AS v(name, type, system_key, sort_order)
ON CONFLICT ("tenant_id", "name") DO NOTHING;
-- Eski «Надбавки и вычеты» spravochnigi (agar saqlangan bo'lsa)
INSERT INTO "payroll_items" ("tenant_id", "name", "code", "type", "calc_type", "color", "comment", "is_active", "sort_order", "updated_at")
SELECT
  t."id",
  LEFT(TRIM(e->>'name'), 160),
  NULLIF(LEFT(TRIM(COALESCE(e->>'code', '')), 64), ''),
  CASE WHEN LOWER(COALESCE(e->>'type', e->>'kind', '')) IN ('deduction', 'vychet', 'вычет', 'удержание') THEN 'deduction' ELSE 'allowance' END,
  'manual',
  NULLIF(LEFT(COALESCE(e->>'color', ''), 16), ''),
  NULLIF(LEFT(COALESCE(e->>'comment', ''), 500), ''),
  CASE WHEN LOWER(COALESCE(e->>'active', 'true')) IN ('false', '0', 'no') THEN false ELSE true END,
  CASE WHEN COALESCE(e->>'sort_order', '') ~ '^-?[0-9]{1,9}$' THEN (e->>'sort_order')::int ELSE 100 END,
  CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t."settings"->'references'->'payroll_adjustment_entries') = 'array'
       THEN t."settings"->'references'->'payroll_adjustment_entries' ELSE '[]'::jsonb END
) AS e
WHERE COALESCE(TRIM(e->>'name'), '') <> ''
ON CONFLICT ("tenant_id", "name") DO NOTHING;
