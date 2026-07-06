-- CreateTable
CREATE TABLE "user_activity_events" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "actor_user_id" INTEGER,
    "event_type" VARCHAR(32) NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "section" VARCHAR(64),
    "entity_type" VARCHAR(64),
    "entity_id" VARCHAR(64),
    "route" VARCHAR(255),
    "label" VARCHAR(255),
    "duration_ms" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activity_events_tenant_id_created_at_idx" ON "user_activity_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_activity_events_tenant_id_actor_user_id_created_at_idx" ON "user_activity_events"("tenant_id", "actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_activity_events_tenant_id_module_section_idx" ON "user_activity_events"("tenant_id", "module", "section");

-- CreateIndex
CREATE INDEX "user_activity_events_tenant_id_entity_type_entity_id_idx" ON "user_activity_events"("tenant_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
