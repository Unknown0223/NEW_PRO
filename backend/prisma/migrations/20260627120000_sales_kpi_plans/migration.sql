-- Планы → Установка планов (KPI reja markazi)

CREATE TABLE "sales_kpi_plans" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "trade_direction_id" INTEGER NOT NULL,
    "kpi_group_id" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_kpi_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_kpi_plan_targets" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "count" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "volume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "acb" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_kpi_plan_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_kpi_plans_unique" ON "sales_kpi_plans"("tenant_id", "month", "year", "trade_direction_id", "kpi_group_id");
CREATE INDEX "sales_kpi_plans_tenant_id_month_year_trade_direction_id_idx" ON "sales_kpi_plans"("tenant_id", "month", "year", "trade_direction_id");

CREATE UNIQUE INDEX "sales_kpi_plan_targets_unique" ON "sales_kpi_plan_targets"("plan_id", "user_id");
CREATE INDEX "sales_kpi_plan_targets_tenant_id_plan_id_idx" ON "sales_kpi_plan_targets"("tenant_id", "plan_id");
CREATE INDEX "sales_kpi_plan_targets_tenant_id_user_id_idx" ON "sales_kpi_plan_targets"("tenant_id", "user_id");

ALTER TABLE "sales_kpi_plans" ADD CONSTRAINT "sales_kpi_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plans" ADD CONSTRAINT "sales_kpi_plans_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "trade_directions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plans" ADD CONSTRAINT "sales_kpi_plans_kpi_group_id_fkey" FOREIGN KEY ("kpi_group_id") REFERENCES "kpi_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plans" ADD CONSTRAINT "sales_kpi_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plans" ADD CONSTRAINT "sales_kpi_plans_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_kpi_plan_targets" ADD CONSTRAINT "sales_kpi_plan_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plan_targets" ADD CONSTRAINT "sales_kpi_plan_targets_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "sales_kpi_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plan_targets" ADD CONSTRAINT "sales_kpi_plan_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_kpi_plan_targets" ADD CONSTRAINT "sales_kpi_plan_targets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
