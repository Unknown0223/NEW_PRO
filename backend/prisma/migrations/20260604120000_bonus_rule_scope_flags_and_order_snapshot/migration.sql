-- Persist restriction mode (assortment vs category) independently of product/category id arrays.
ALTER TABLE "bonus_rules" ADD COLUMN IF NOT EXISTS "scope_restrict_assortment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bonus_rules" ADD COLUMN IF NOT EXISTS "scope_restrict_category" BOOLEAN NOT NULL DEFAULT false;

UPDATE "bonus_rules"
SET
  "scope_restrict_assortment" = (
    cardinality("product_ids") > 0 AND cardinality("product_category_ids") = 0
  ),
  "scope_restrict_category" = (cardinality("product_category_ids") > 0);

-- Snapshot of bonus rules at apply time (order history).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "applied_bonus_rules_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb;
