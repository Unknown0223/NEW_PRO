-- KpiResult model (group-05) — prod’da jadval yo‘q edi, eksport P2021 berardi
CREATE TABLE IF NOT EXISTS "kpi_results" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kpi_group_id" INTEGER,
    "period_month" VARCHAR(7) NOT NULL,
    "metric" VARCHAR(64) NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "target" DECIMAL(15,2),
    "score" DECIMAL(5,2),
    "comment" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_results_tenant_id_user_id_period_month_idx"
  ON "kpi_results"("tenant_id", "user_id", "period_month");

CREATE INDEX IF NOT EXISTS "idx_kpi_results_period_user"
  ON "kpi_results"("tenant_id", "period_month", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kpi_results_tenant_id_fkey'
  ) THEN
    ALTER TABLE "kpi_results"
      ADD CONSTRAINT "kpi_results_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
