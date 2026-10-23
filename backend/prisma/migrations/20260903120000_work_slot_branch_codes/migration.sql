-- WorkSlot: bir joyga bir nechta filial
ALTER TABLE "work_slots"
  ADD COLUMN IF NOT EXISTS "branch_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "work_slots"
SET "branch_codes" = ARRAY[TRIM("branch_code")]
WHERE "branch_code" IS NOT NULL
  AND TRIM("branch_code") <> ''
  AND (cardinality("branch_codes") = 0 OR "branch_codes" IS NULL);
