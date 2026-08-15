-- Bonus ichki shartlar (clauses): связанный o‘rniga AND gates + grants_reward

CREATE TABLE IF NOT EXISTS "bonus_rule_clauses" (
    "id" SERIAL NOT NULL,
    "bonus_rule_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "grants_reward" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "client_category" TEXT,
    "payment_type" TEXT,
    "client_type" TEXT,
    "sales_channel" TEXT,
    "price_type" TEXT,
    "product_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "bonus_product_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "product_category_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "scope_restrict_assortment" BOOLEAN NOT NULL DEFAULT false,
    "scope_restrict_category" BOOLEAN NOT NULL DEFAULT false,
    "target_all_clients" BOOLEAN NOT NULL DEFAULT true,
    "selected_client_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "in_blocks" BOOLEAN NOT NULL DEFAULT true,
    "once_per_client" BOOLEAN NOT NULL DEFAULT false,
    "one_plus_one_gift" BOOLEAN NOT NULL DEFAULT false,
    "buy_qty" INTEGER,
    "free_qty" INTEGER,
    "min_sum" DECIMAL(15,2),
    "sum_threshold_scope" VARCHAR(32) NOT NULL DEFAULT 'order',
    "scope_branch_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope_agent_user_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "scope_trade_direction_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bonus_rule_clauses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bonus_rule_clauses_bonus_rule_id_idx" ON "bonus_rule_clauses"("bonus_rule_id");

ALTER TABLE "bonus_rule_clauses"
  ADD CONSTRAINT "bonus_rule_clauses_bonus_rule_id_fkey"
  FOREIGN KEY ("bonus_rule_id") REFERENCES "bonus_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bonus_rule_conditions"
  ADD COLUMN IF NOT EXISTS "clause_id" INTEGER;

CREATE INDEX IF NOT EXISTS "bonus_rule_conditions_clause_id_idx" ON "bonus_rule_conditions"("clause_id");

ALTER TABLE "bonus_rule_conditions"
  ADD CONSTRAINT "bonus_rule_conditions_clause_id_fkey"
  FOREIGN KEY ("clause_id") REFERENCES "bonus_rule_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- qty / sum gift qoidalar: asosiy clause (grants_reward=true)
INSERT INTO "bonus_rule_clauses" (
  "bonus_rule_id", "sort_order", "grants_reward", "priority",
  "client_category", "payment_type", "client_type", "sales_channel", "price_type",
  "product_ids", "bonus_product_ids", "product_category_ids",
  "scope_restrict_assortment", "scope_restrict_category",
  "target_all_clients", "selected_client_ids",
  "in_blocks", "once_per_client", "one_plus_one_gift",
  "buy_qty", "free_qty", "min_sum", "sum_threshold_scope",
  "scope_branch_codes", "scope_agent_user_ids", "scope_trade_direction_ids",
  "created_at", "updated_at"
)
SELECT
  r."id", 0, true, r."priority",
  r."client_category", r."payment_type", r."client_type", r."sales_channel", r."price_type",
  COALESCE(r."product_ids", ARRAY[]::INTEGER[]),
  COALESCE(r."bonus_product_ids", ARRAY[]::INTEGER[]),
  COALESCE(r."product_category_ids", ARRAY[]::INTEGER[]),
  COALESCE(r."scope_restrict_assortment", false),
  COALESCE(r."scope_restrict_category", false),
  COALESCE(r."target_all_clients", true),
  COALESCE(r."selected_client_ids", ARRAY[]::INTEGER[]),
  COALESCE(r."in_blocks", true),
  COALESCE(r."once_per_client", false),
  COALESCE(r."one_plus_one_gift", false),
  r."buy_qty", r."free_qty", r."min_sum",
  COALESCE(r."sum_threshold_scope", 'order'),
  COALESCE(r."scope_branch_codes", ARRAY[]::TEXT[]),
  COALESCE(r."scope_agent_user_ids", ARRAY[]::INTEGER[]),
  COALESCE(r."scope_trade_direction_ids", ARRAY[]::INTEGER[]),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "bonus_rules" r
WHERE r."type" IN ('qty', 'sum')
  AND (r."discount_pct" IS NULL OR r."discount_pct" <= 0)
  AND NOT EXISTS (
    SELECT 1 FROM "bonus_rule_clauses" c WHERE c."bonus_rule_id" = r."id"
  );

-- Legacy conditions → asosiy clause
UPDATE "bonus_rule_conditions" bc
SET "clause_id" = c."id"
FROM "bonus_rule_clauses" c
WHERE bc."bonus_rule_id" = c."bonus_rule_id"
  AND c."sort_order" = 0
  AND bc."clause_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "bonus_rules" r
    WHERE r."id" = bc."bonus_rule_id"
      AND r."type" IN ('qty', 'sum')
      AND (r."discount_pct" IS NULL OR r."discount_pct" <= 0)
  );

-- Prereq qoidalardan gate clause lar (grants_reward=false)
INSERT INTO "bonus_rule_clauses" (
  "bonus_rule_id", "sort_order", "grants_reward", "priority",
  "client_category", "payment_type", "client_type", "sales_channel", "price_type",
  "product_ids", "bonus_product_ids", "product_category_ids",
  "scope_restrict_assortment", "scope_restrict_category",
  "target_all_clients", "selected_client_ids",
  "in_blocks", "once_per_client", "one_plus_one_gift",
  "buy_qty", "free_qty", "min_sum", "sum_threshold_scope",
  "scope_branch_codes", "scope_agent_user_ids", "scope_trade_direction_ids",
  "created_at", "updated_at"
)
SELECT
  host."id",
  10 + ord.ord,
  false,
  pr."priority",
  pr."client_category", pr."payment_type", pr."client_type", pr."sales_channel", pr."price_type",
  COALESCE(pr."product_ids", ARRAY[]::INTEGER[]),
  ARRAY[]::INTEGER[],
  COALESCE(pr."product_category_ids", ARRAY[]::INTEGER[]),
  COALESCE(pr."scope_restrict_assortment", false),
  COALESCE(pr."scope_restrict_category", false),
  COALESCE(pr."target_all_clients", true),
  COALESCE(pr."selected_client_ids", ARRAY[]::INTEGER[]),
  COALESCE(pr."in_blocks", true),
  COALESCE(pr."once_per_client", false),
  false,
  pr."buy_qty", pr."free_qty", pr."min_sum",
  COALESCE(pr."sum_threshold_scope", 'order'),
  COALESCE(pr."scope_branch_codes", ARRAY[]::TEXT[]),
  COALESCE(pr."scope_agent_user_ids", ARRAY[]::INTEGER[]),
  COALESCE(pr."scope_trade_direction_ids", ARRAY[]::INTEGER[]),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "bonus_rules" host
CROSS JOIN LATERAL unnest(COALESCE(host."prerequisite_rule_ids", ARRAY[]::INTEGER[]))
  WITH ORDINALITY AS ord(prereq_id, ord)
JOIN "bonus_rules" pr ON pr."id" = ord.prereq_id AND pr."tenant_id" = host."tenant_id"
WHERE host."type" IN ('qty', 'sum')
  AND (host."discount_pct" IS NULL OR host."discount_pct" <= 0)
  AND cardinality(COALESCE(host."prerequisite_rule_ids", ARRAY[]::INTEGER[])) > 0;

-- Bonus hostlardan связанный IDlarni tozalash (skidka saqlanadi)
UPDATE "bonus_rules"
SET "prerequisite_rule_ids" = ARRAY[]::INTEGER[]
WHERE "type" IN ('qty', 'sum')
  AND ("discount_pct" IS NULL OR "discount_pct" <= 0)
  AND cardinality(COALESCE("prerequisite_rule_ids", ARRAY[]::INTEGER[])) > 0;
