-- Hisob sxemalari: rol/filial/yo'nalish/lavozim bo'yicha qoidalar to'plami, oy bo'yicha versiya va xodim farqlari.
CREATE TABLE "payroll_schemes" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "trade_direction_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "positions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "valid_from" INTEGER NOT NULL,
  "valid_to" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
  "note" VARCHAR(500),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_schemes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_schemes_tenant_id_is_active_idx" ON "payroll_schemes"("tenant_id", "is_active");

CREATE TABLE "payroll_scheme_rules" (
  "id" SERIAL NOT NULL,
  "scheme_id" INTEGER NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "item_id" INTEGER,
  "sort" INTEGER NOT NULL DEFAULT 100,
  "params" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "payroll_scheme_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_scheme_rules_scheme_id_code_key" ON "payroll_scheme_rules"("scheme_id", "code");
ALTER TABLE "payroll_scheme_rules"
  ADD CONSTRAINT "payroll_scheme_rules_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "payroll_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_scheme_overrides" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "rule_code" VARCHAR(32) NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "valid_from" INTEGER NOT NULL,
  "valid_to" INTEGER,
  "note" VARCHAR(500),
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_scheme_overrides_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_scheme_overrides_tenant_id_user_id_idx" ON "payroll_scheme_overrides"("tenant_id", "user_id");

ALTER TABLE "payroll_records" ADD COLUMN "scheme_id" INTEGER;
ALTER TABLE "payroll_record_lines" ADD COLUMN "explain" JSONB;
