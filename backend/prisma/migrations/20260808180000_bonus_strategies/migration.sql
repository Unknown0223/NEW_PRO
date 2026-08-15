-- CreateTable
CREATE TABLE IF NOT EXISTS "bonus_strategies" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "scope_branch_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope_agent_user_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "scope_trade_direction_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bonus_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bonus_strategy_members" (
    "id" SERIAL NOT NULL,
    "strategy_id" INTEGER NOT NULL,
    "bonus_rule_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bonus_strategy_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bonus_strategy_members_strategy_id_bonus_rule_id_key" ON "bonus_strategy_members"("strategy_id", "bonus_rule_id");
CREATE INDEX IF NOT EXISTS "bonus_strategy_members_bonus_rule_id_idx" ON "bonus_strategy_members"("bonus_rule_id");
CREATE INDEX IF NOT EXISTS "bonus_strategies_tenant_id_is_active_idx" ON "bonus_strategies"("tenant_id", "is_active");

ALTER TABLE "bonus_strategies" DROP CONSTRAINT IF EXISTS "bonus_strategies_tenant_id_fkey";
ALTER TABLE "bonus_strategies" ADD CONSTRAINT "bonus_strategies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bonus_strategy_members" DROP CONSTRAINT IF EXISTS "bonus_strategy_members_strategy_id_fkey";
ALTER TABLE "bonus_strategy_members" ADD CONSTRAINT "bonus_strategy_members_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "bonus_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bonus_strategy_members" DROP CONSTRAINT IF EXISTS "bonus_strategy_members_bonus_rule_id_fkey";
ALTER TABLE "bonus_strategy_members" ADD CONSTRAINT "bonus_strategy_members_bonus_rule_id_fkey" FOREIGN KEY ("bonus_rule_id") REFERENCES "bonus_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;