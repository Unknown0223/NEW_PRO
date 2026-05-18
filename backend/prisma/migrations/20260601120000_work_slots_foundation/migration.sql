-- Work slots (ishchi o'rni) foundation

CREATE TABLE "work_slots" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "slot_code" VARCHAR(32) NOT NULL,
    "label" VARCHAR(128),
    "branch_code" VARCHAR(120),
    "direction_id" INTEGER,
    "slot_type" VARCHAR(32) NOT NULL DEFAULT 'agent',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "slot_user_links" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "ended_by" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_user_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "slot_audit_entries" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "prev_user_id" INTEGER,
    "next_user_id" INTEGER,
    "action" VARCHAR(32) NOT NULL,
    "actor_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_audit_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_agent_assignments" ADD COLUMN "lock_type" VARCHAR(24) NOT NULL DEFAULT 'none';
ALTER TABLE "client_agent_assignments" ADD COLUMN "lock_reason" TEXT;
ALTER TABLE "client_agent_assignments" ADD COLUMN "lock_set_by" INTEGER;
ALTER TABLE "client_agent_assignments" ADD COLUMN "auto_assign_status" VARCHAR(32) NOT NULL DEFAULT 'assigned';
ALTER TABLE "client_agent_assignments" ADD COLUMN "work_slot_id" INTEGER;

CREATE UNIQUE INDEX "work_slots_tenant_id_slot_code_key" ON "work_slots"("tenant_id", "slot_code");
CREATE INDEX "work_slots_tenant_id_branch_code_idx" ON "work_slots"("tenant_id", "branch_code");
CREATE INDEX "work_slots_tenant_id_slot_type_is_active_idx" ON "work_slots"("tenant_id", "slot_type", "is_active");

CREATE INDEX "slot_user_links_tenant_id_slot_id_ended_at_idx" ON "slot_user_links"("tenant_id", "slot_id", "ended_at");
CREATE INDEX "slot_user_links_tenant_id_user_id_ended_at_idx" ON "slot_user_links"("tenant_id", "user_id", "ended_at");

CREATE UNIQUE INDEX "slot_user_links_one_active_per_slot" ON "slot_user_links"("slot_id") WHERE "ended_at" IS NULL;

CREATE INDEX "slot_audit_entries_tenant_id_slot_id_created_at_idx" ON "slot_audit_entries"("tenant_id", "slot_id", "created_at" DESC);

CREATE INDEX "client_agent_assignments_tenant_id_auto_assign_status_idx" ON "client_agent_assignments"("tenant_id", "auto_assign_status");
CREATE INDEX "client_agent_assignments_work_slot_id_idx" ON "client_agent_assignments"("work_slot_id");

ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "trade_directions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slot_user_links" ADD CONSTRAINT "slot_user_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_user_links" ADD CONSTRAINT "slot_user_links_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "work_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_user_links" ADD CONSTRAINT "slot_user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slot_audit_entries" ADD CONSTRAINT "slot_audit_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_audit_entries" ADD CONSTRAINT "slot_audit_entries_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "work_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_audit_entries" ADD CONSTRAINT "slot_audit_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_agent_assignments" ADD CONSTRAINT "client_agent_assignments_work_slot_id_fkey" FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_agent_assignments" ADD CONSTRAINT "client_agent_assignments_lock_set_by_fkey" FOREIGN KEY ("lock_set_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
