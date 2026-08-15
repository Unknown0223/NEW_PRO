-- Diagnostika: faqat xatoliklar (mobil + backend).
CREATE TABLE "error_events" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "source" VARCHAR(16) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'error',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" VARCHAR(64),
    "http_status" INTEGER,
    "error_code" VARCHAR(128),
    "message" VARCHAR(500) NOT NULL,
    "path" VARCHAR(255),
    "method" VARCHAR(16),
    "platform" VARCHAR(16) NOT NULL,
    "apk_version" VARCHAR(64),
    "device_name" VARCHAR(128),
    "device_id" VARCHAR(128),
    "module" VARCHAR(64),
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_events_tenant_id_occurred_at_idx" ON "error_events"("tenant_id", "occurred_at" DESC);
CREATE INDEX "error_events_tenant_id_user_id_occurred_at_idx" ON "error_events"("tenant_id", "user_id", "occurred_at" DESC);
CREATE INDEX "error_events_tenant_id_request_id_idx" ON "error_events"("tenant_id", "request_id");
CREATE INDEX "error_events_tenant_id_source_occurred_at_idx" ON "error_events"("tenant_id", "source", "occurred_at" DESC);

ALTER TABLE "error_events" ADD CONSTRAINT "error_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
