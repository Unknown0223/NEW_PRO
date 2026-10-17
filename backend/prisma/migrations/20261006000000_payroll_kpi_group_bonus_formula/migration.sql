-- Add bonus_formula column to kpi_groups table
-- Allows per-group KPI formula configuration (replaces hardcoded RES presets)

ALTER TABLE "kpi_groups" ADD COLUMN "bonus_formula" TEXT;
