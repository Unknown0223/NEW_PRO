-- Bir nechta savdo yo'nalishi (scope) — bonus qoidalari kabi massiv
ALTER TABLE "order_restriction_rules"
  ADD COLUMN IF NOT EXISTS "scope_trade_direction_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "order_auto_confirm_rules"
  ADD COLUMN IF NOT EXISTS "scope_trade_direction_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "order_restriction_rules"
SET "scope_trade_direction_refs" = ARRAY["trade_direction_ref"]::TEXT[]
WHERE "trade_direction_ref" IS NOT NULL
  AND TRIM("trade_direction_ref") <> ''
  AND COALESCE(array_length("scope_trade_direction_refs", 1), 0) = 0;

UPDATE "order_auto_confirm_rules"
SET "scope_trade_direction_refs" = ARRAY["trade_direction_ref"]::TEXT[]
WHERE "trade_direction_ref" IS NOT NULL
  AND TRIM("trade_direction_ref") <> ''
  AND COALESCE(array_length("scope_trade_direction_refs", 1), 0) = 0;
