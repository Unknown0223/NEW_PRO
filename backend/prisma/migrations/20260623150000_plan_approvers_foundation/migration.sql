-- Планы → Настройка утверждающих (tasdiqlash zanjiri).
-- Yo'nalish (TradeDirection) × supervayzer bo'yicha ko'p bosqichli approval chain
-- hamda tenant bo'yicha umumiy «главные утверждающие» (asosiy rahbarlar).

-- CreateTable
CREATE TABLE "plan_approver_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "direction_id" INTEGER NOT NULL,
    "supervisor_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_approver_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_approver_levels" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "config_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "approver_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_approver_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_approver_leaders" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "leader_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_approver_leaders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_approver_configs_unique" ON "plan_approver_configs"("tenant_id", "direction_id", "supervisor_user_id");

-- CreateIndex
CREATE INDEX "plan_approver_configs_tenant_id_direction_id_idx" ON "plan_approver_configs"("tenant_id", "direction_id");

-- CreateIndex
CREATE INDEX "plan_approver_levels_tenant_id_config_id_idx" ON "plan_approver_levels"("tenant_id", "config_id");

-- CreateIndex
CREATE INDEX "plan_approver_levels_config_id_position_idx" ON "plan_approver_levels"("config_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "plan_approver_leaders_tenant_id_leader_user_id_key" ON "plan_approver_leaders"("tenant_id", "leader_user_id");

-- CreateIndex
CREATE INDEX "plan_approver_leaders_tenant_id_position_idx" ON "plan_approver_leaders"("tenant_id", "position");

-- AddForeignKey
ALTER TABLE "plan_approver_configs" ADD CONSTRAINT "plan_approver_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_configs" ADD CONSTRAINT "plan_approver_configs_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "trade_directions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_configs" ADD CONSTRAINT "plan_approver_configs_supervisor_user_id_fkey" FOREIGN KEY ("supervisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_levels" ADD CONSTRAINT "plan_approver_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_levels" ADD CONSTRAINT "plan_approver_levels_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "plan_approver_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_levels" ADD CONSTRAINT "plan_approver_levels_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_leaders" ADD CONSTRAINT "plan_approver_leaders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_approver_leaders" ADD CONSTRAINT "plan_approver_leaders_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
