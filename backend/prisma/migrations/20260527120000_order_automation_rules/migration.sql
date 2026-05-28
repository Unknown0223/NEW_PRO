-- Order automation: restriction rules, auto-confirm rules, schedules

CREATE TABLE "order_restriction_rules" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT NOT NULL DEFAULT '',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "amount_from" DECIMAL(15,2),
    "amount_to" DECIMAL(15,2),
    "scope_agent_user_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "scope_warehouse_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "scope_territory_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_zones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "payment_method_ref" VARCHAR(64),
    "trade_direction_ref" VARCHAR(128),
    "consignment_mode" VARCHAR(8) NOT NULL DEFAULT 'all',
    "created_by_user_id" INTEGER,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_restriction_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_auto_confirm_rules" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT NOT NULL DEFAULT '',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "amount_from" DECIMAL(15,2),
    "amount_to" DECIMAL(15,2),
    "scope_agent_user_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "scope_warehouse_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "scope_territory_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_zones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope_cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "payment_method_ref" VARCHAR(64),
    "trade_direction_ref" VARCHAR(128),
    "consignment_mode" VARCHAR(8) NOT NULL DEFAULT 'all',
    "request_type_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "execution_type" VARCHAR(32) NOT NULL DEFAULT 'instant',
    "execution_time" TIMESTAMP(3),
    "n_value" INTEGER,
    "created_by_user_id" INTEGER,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_auto_confirm_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_auto_confirm_schedules" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_auto_confirm_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_restriction_rules_tenant_id_is_active_idx" ON "order_restriction_rules"("tenant_id", "is_active");
CREATE INDEX "order_auto_confirm_rules_tenant_id_is_active_idx" ON "order_auto_confirm_rules"("tenant_id", "is_active");
CREATE INDEX "order_auto_confirm_schedules_tenant_id_status_run_at_idx" ON "order_auto_confirm_schedules"("tenant_id", "status", "run_at");
CREATE INDEX "order_auto_confirm_schedules_order_id_idx" ON "order_auto_confirm_schedules"("order_id");

ALTER TABLE "order_restriction_rules" ADD CONSTRAINT "order_restriction_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_restriction_rules" ADD CONSTRAINT "order_restriction_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_restriction_rules" ADD CONSTRAINT "order_restriction_rules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_auto_confirm_rules" ADD CONSTRAINT "order_auto_confirm_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_auto_confirm_rules" ADD CONSTRAINT "order_auto_confirm_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_auto_confirm_rules" ADD CONSTRAINT "order_auto_confirm_rules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_auto_confirm_schedules" ADD CONSTRAINT "order_auto_confirm_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_auto_confirm_schedules" ADD CONSTRAINT "order_auto_confirm_schedules_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_auto_confirm_schedules" ADD CONSTRAINT "order_auto_confirm_schedules_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "order_auto_confirm_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
