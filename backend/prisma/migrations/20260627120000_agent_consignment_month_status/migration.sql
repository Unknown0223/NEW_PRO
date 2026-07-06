CREATE TABLE IF NOT EXISTS "agent_consignment_month_status" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "agent_user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period_closed_at" TIMESTAMP(3),
    "debt_cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_consignment_month_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_consignment_month_status_tenant_agent_ym_key"
    ON "agent_consignment_month_status"("tenant_id", "agent_user_id", "year", "month");

CREATE INDEX IF NOT EXISTS "agent_consignment_month_status_tenant_ym_idx"
    ON "agent_consignment_month_status"("tenant_id", "year", "month");

ALTER TABLE "agent_consignment_month_status"
    ADD CONSTRAINT "agent_consignment_month_status_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_consignment_month_status"
    ADD CONSTRAINT "agent_consignment_month_status_agent_user_id_fkey"
    FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
