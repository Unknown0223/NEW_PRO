-- P1: KPI target / KPI guruh / marshrut kunlari → work_slot_id (nullable dual-write)

ALTER TABLE "sales_kpi_plan_targets" ADD COLUMN IF NOT EXISTS "work_slot_id" INTEGER;
ALTER TABLE "kpi_group_agents" ADD COLUMN IF NOT EXISTS "work_slot_id" INTEGER;
ALTER TABLE "agent_route_days" ADD COLUMN IF NOT EXISTS "work_slot_id" INTEGER;

CREATE INDEX IF NOT EXISTS "sales_kpi_plan_targets_work_slot_id_idx" ON "sales_kpi_plan_targets"("work_slot_id");
CREATE INDEX IF NOT EXISTS "kpi_group_agents_work_slot_id_idx" ON "kpi_group_agents"("work_slot_id");
CREATE INDEX IF NOT EXISTS "agent_route_days_work_slot_id_idx" ON "agent_route_days"("work_slot_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_kpi_plan_targets_work_slot_id_fkey'
  ) THEN
    ALTER TABLE "sales_kpi_plan_targets"
      ADD CONSTRAINT "sales_kpi_plan_targets_work_slot_id_fkey"
      FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kpi_group_agents_work_slot_id_fkey'
  ) THEN
    ALTER TABLE "kpi_group_agents"
      ADD CONSTRAINT "kpi_group_agents_work_slot_id_fkey"
      FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_route_days_work_slot_id_fkey'
  ) THEN
    ALTER TABLE "agent_route_days"
      ADD CONSTRAINT "agent_route_days_work_slot_id_fkey"
      FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
