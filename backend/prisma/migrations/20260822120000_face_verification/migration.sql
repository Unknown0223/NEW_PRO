-- Face verification audit + daily random checkpoints
CREATE TABLE "face_verification_logs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_slot_id" INTEGER,
    "context" VARCHAR(32) NOT NULL,
    "snapshot_storage_key" VARCHAR(512) NOT NULL,
    "reference_storage_key" VARCHAR(512),
    "order_id" INTEGER,
    "client_id" INTEGER,
    "status" VARCHAR(24) NOT NULL DEFAULT 'recorded',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_verification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "face_verification_daily_states" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "order_action_count" INTEGER NOT NULL DEFAULT 0,
    "order_verify_count" INTEGER NOT NULL DEFAULT 0,
    "daily_login_verified" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint_order_nos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_verification_daily_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "face_verification_daily_states_tenant_id_user_id_work_date_key"
    ON "face_verification_daily_states"("tenant_id", "user_id", "work_date");

CREATE INDEX "face_verification_logs_tenant_id_user_id_created_at_idx"
    ON "face_verification_logs"("tenant_id", "user_id", "created_at");

CREATE INDEX "face_verification_logs_tenant_id_user_id_context_created_at_idx"
    ON "face_verification_logs"("tenant_id", "user_id", "context", "created_at");

ALTER TABLE "face_verification_logs" ADD CONSTRAINT "face_verification_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "face_verification_logs" ADD CONSTRAINT "face_verification_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "face_verification_logs" ADD CONSTRAINT "face_verification_logs_work_slot_id_fkey"
    FOREIGN KEY ("work_slot_id") REFERENCES "work_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "face_verification_daily_states" ADD CONSTRAINT "face_verification_daily_states_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "face_verification_daily_states" ADD CONSTRAINT "face_verification_daily_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
