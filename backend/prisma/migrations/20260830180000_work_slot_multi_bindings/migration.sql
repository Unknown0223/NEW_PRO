-- WorkSlot: bir joyga bir nechta ombor / kassa / territory
ALTER TABLE "work_slots"
  ADD COLUMN IF NOT EXISTS "warehouse_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "cash_desk_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "territories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Singular FK → array backfill (primary saqlanadi)
UPDATE "work_slots"
SET "warehouse_ids" = ARRAY["warehouse_id"]
WHERE "warehouse_id" IS NOT NULL
  AND (cardinality("warehouse_ids") = 0 OR "warehouse_ids" IS NULL);

UPDATE "work_slots"
SET "cash_desk_ids" = ARRAY["cash_desk_id"]
WHERE "cash_desk_id" IS NOT NULL
  AND (cardinality("cash_desk_ids") = 0 OR "cash_desk_ids" IS NULL);

UPDATE "work_slots"
SET "territories" = ARRAY[TRIM("territory")]
WHERE "territory" IS NOT NULL
  AND TRIM("territory") <> ''
  AND (cardinality("territories") = 0 OR "territories" IS NULL);
