-- Taklifiy reja: umumiy draft + qatorlar (rasmiy SalesKpiPlanTarget dan ajratilgan).

CREATE TABLE "sales_plan_proposals" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "target_year" INTEGER NOT NULL,
    "target_month" INTEGER NOT NULL,
    "source_year" INTEGER NOT NULL,
    "source_month" INTEGER NOT NULL,
    "trade_direction_id" INTEGER NOT NULL,
    "metric" VARCHAR(16) NOT NULL DEFAULT 'cost',
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "name" VARCHAR(160),
    "config" JSONB NOT NULL DEFAULT '{}',
    "snapshot_hash" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" VARCHAR(64),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "applied_by" INTEGER,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_plan_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_plan_proposal_rows" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_slot_id" INTEGER,
    "kpi_group_id" INTEGER NOT NULL,
    "source_fact" DECIMAL(18,2),
    "source_plan" DECIMAL(18,2),
    "base_value" DECIMAL(18,2),
    "proposed_value" DECIMAL(18,2),
    "manual_value" DECIMAL(18,2),
    "manual_reason" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "resolved_rule" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_plan_proposal_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_plan_proposals_unique" ON "sales_plan_proposals"("tenant_id", "trade_direction_id", "target_year", "target_month", "metric");
CREATE INDEX "sales_plan_proposals_tenant_id_status_idx" ON "sales_plan_proposals"("tenant_id", "status");
CREATE INDEX "sales_plan_proposals_tenant_dir_period_idx" ON "sales_plan_proposals"("tenant_id", "trade_direction_id", "target_year", "target_month");

CREATE UNIQUE INDEX "sales_plan_proposal_rows_unique" ON "sales_plan_proposal_rows"("proposal_id", "user_id", "kpi_group_id");
CREATE INDEX "sales_plan_proposal_rows_tenant_proposal_idx" ON "sales_plan_proposal_rows"("tenant_id", "proposal_id");
CREATE INDEX "sales_plan_proposal_rows_tenant_user_idx" ON "sales_plan_proposal_rows"("tenant_id", "user_id");

ALTER TABLE "sales_plan_proposals" ADD CONSTRAINT "sales_plan_proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposals" ADD CONSTRAINT "sales_plan_proposals_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "trade_directions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposals" ADD CONSTRAINT "sales_plan_proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposals" ADD CONSTRAINT "sales_plan_proposals_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposals" ADD CONSTRAINT "sales_plan_proposals_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_plan_proposal_rows" ADD CONSTRAINT "sales_plan_proposal_rows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposal_rows" ADD CONSTRAINT "sales_plan_proposal_rows_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "sales_plan_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposal_rows" ADD CONSTRAINT "sales_plan_proposal_rows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposal_rows" ADD CONSTRAINT "sales_plan_proposal_rows_work_slot_id_fkey" FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_plan_proposal_rows" ADD CONSTRAINT "sales_plan_proposal_rows_kpi_group_id_fkey" FOREIGN KEY ("kpi_group_id") REFERENCES "kpi_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
