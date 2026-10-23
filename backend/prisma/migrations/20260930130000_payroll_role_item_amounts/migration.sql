ALTER TABLE "payroll_role_configs" ADD COLUMN IF NOT EXISTS "item_amounts" JSONB NOT NULL DEFAULT '{}';
