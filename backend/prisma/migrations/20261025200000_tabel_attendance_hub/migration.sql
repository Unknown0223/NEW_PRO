-- Табель и посещаемость moduli (HR Hub integratsiyasi). Idempotent.
-- Avvalgi sinov migratsiyasidan qolgan jadvallarni tozalab, yangi standart jadvallarni yaratadi.

DROP TABLE IF EXISTS "attendance_days" CASCADE;
DROP TABLE IF EXISTS "attendance_marks" CASCADE;
DROP TABLE IF EXISTS "attendance_face_challenges" CASCADE;
DROP TABLE IF EXISTS "absence_requests" CASCADE;
DROP TABLE IF EXISTS "user_work_schedules" CASCADE;
DROP TABLE IF EXISTS "attendance_devices" CASCADE;
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261021180000_attendance_autonomy';

CREATE TABLE IF NOT EXISTS "attendance_shifts" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "start_time" VARCHAR(8) NOT NULL DEFAULT '09:00',
  "end_time" VARCHAR(8) NOT NULL DEFAULT '18:00',
  "break_minutes" INTEGER NOT NULL DEFAULT 60,
  "grace_minutes" INTEGER NOT NULL DEFAULT 15,
  "role" VARCHAR(64),
  "branch" VARCHAR(120),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "comment" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_shifts_tenant_id_is_active_idx" ON "attendance_shifts"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "attendance_shifts_tenant_id_role_branch_idx" ON "attendance_shifts"("tenant_id", "role", "branch");

CREATE TABLE IF NOT EXISTS "attendance_locations" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" VARCHAR(300),
  "branch" VARCHAR(120),
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "radius_m" INTEGER NOT NULL DEFAULT 150,
  "require_comment_outside" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_locations_tenant_id_is_active_idx" ON "attendance_locations"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "attendance_locations_tenant_id_branch_idx" ON "attendance_locations"("tenant_id", "branch");

CREATE TABLE IF NOT EXISTS "attendance_punches" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "work_date" DATE NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "direction" VARCHAR(16) NOT NULL DEFAULT 'IN',
  "role_in_day" VARCHAR(24) NOT NULL DEFAULT 'in',
  "source" VARCHAR(32) NOT NULL DEFAULT 'mobile_photo',
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "accuracy_m" DOUBLE PRECISION,
  "outside_geofence" BOOLEAN NOT NULL DEFAULT false,
  "location_id" INTEGER,
  "device_id" INTEGER,
  "kiosk_leader_id" INTEGER,
  "photo_front_key" VARCHAR(512),
  "photo_back_key" VARCHAR(512),
  "video_front_key" VARCHAR(512),
  "video_back_key" VARCHAR(512),
  "capture_mode" VARCHAR(24),
  "duration_sec" INTEGER,
  "day_code" INTEGER,
  "face_score" DOUBLE PRECISION,
  "liveness_steps" JSONB NOT NULL DEFAULT '[]',
  "integrity_json" JSONB NOT NULL DEFAULT '{}',
  "is_valid" BOOLEAN NOT NULL DEFAULT true,
  "review_status" VARCHAR(24) NOT NULL DEFAULT 'auto',
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "comment" VARCHAR(500),
  "media_purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_punches_tenant_id_user_id_work_date_idx" ON "attendance_punches"("tenant_id", "user_id", "work_date");
CREATE INDEX IF NOT EXISTS "attendance_punches_tenant_id_work_date_is_valid_idx" ON "attendance_punches"("tenant_id", "work_date", "is_valid");
CREATE INDEX IF NOT EXISTS "attendance_punches_tenant_id_review_status_idx" ON "attendance_punches"("tenant_id", "review_status");
CREATE INDEX IF NOT EXISTS "attendance_punches_tenant_id_occurred_at_idx" ON "attendance_punches"("tenant_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "attendance_day_records" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "work_date" DATE NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'not_started',
  "first_in_at" TIMESTAMP(3),
  "last_out_at" TIMESTAMP(3),
  "late_minutes" INTEGER NOT NULL DEFAULT 0,
  "late_excused" BOOLEAN NOT NULL DEFAULT false,
  "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
  "worked_minutes" INTEGER NOT NULL DEFAULT 0,
  "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
  "source" VARCHAR(32) NOT NULL DEFAULT 'auto',
  "override_by" INTEGER,
  "override_comment" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_day_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_day_records_tenant_id_user_id_work_date_key" ON "attendance_day_records"("tenant_id", "user_id", "work_date");
CREATE INDEX IF NOT EXISTS "attendance_day_records_tenant_id_work_date_status_idx" ON "attendance_day_records"("tenant_id", "work_date", "status");

CREATE TABLE IF NOT EXISTS "punch_day_codes" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "work_date" DATE NOT NULL,
  "code" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "punch_day_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "punch_day_codes_tenant_id_user_id_work_date_key" ON "punch_day_codes"("tenant_id", "user_id", "work_date");
CREATE INDEX IF NOT EXISTS "punch_day_codes_tenant_id_work_date_idx" ON "punch_day_codes"("tenant_id", "work_date");

CREATE TABLE IF NOT EXISTS "staff_absence_requests" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "hours" DOUBLE PRECISION,
  "reason" VARCHAR(500),
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "attachment_key" VARCHAR(512),
  "approved_by" INTEGER,
  "approved_at" TIMESTAMP(3),
  "decision_comment" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_absence_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_absence_requests_tenant_id_status_from_date_idx" ON "staff_absence_requests"("tenant_id", "status", "from_date");
CREATE INDEX IF NOT EXISTS "staff_absence_requests_tenant_id_user_id_from_date_idx" ON "staff_absence_requests"("tenant_id", "user_id", "from_date");

CREATE TABLE IF NOT EXISTS "staff_clearance_sheets" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'open',
  "warehouse_cleared" BOOLEAN NOT NULL DEFAULT false,
  "cash_cleared" BOOLEAN NOT NULL DEFAULT false,
  "consignment_cleared" BOOLEAN NOT NULL DEFAULT false,
  "equipment_cleared" BOOLEAN NOT NULL DEFAULT false,
  "work_slot_cleared" BOOLEAN NOT NULL DEFAULT false,
  "items_json" JSONB NOT NULL DEFAULT '[]',
  "comment" VARCHAR(500),
  "approved_by" INTEGER,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_clearance_sheets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_clearance_sheets_tenant_id_status_idx" ON "staff_clearance_sheets"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "staff_clearance_sheets_tenant_id_user_id_idx" ON "staff_clearance_sheets"("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "attendance_devices" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "vendor" VARCHAR(32) NOT NULL DEFAULT 'hikvision',
  "serial_no" VARCHAR(120),
  "branch" VARCHAR(120),
  "location_id" INTEGER,
  "pairing_code" VARCHAR(32),
  "device_token_hash" VARCHAR(128),
  "tunnel_url" VARCHAR(300),
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "last_seen_at" TIMESTAMP(3),
  "synced_faces_count" INTEGER NOT NULL DEFAULT 0,
  "last_sync_at" TIMESTAMP(3),
  "meta" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_devices_tenant_id_status_idx" ON "attendance_devices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "attendance_devices_pairing_code_idx" ON "attendance_devices"("pairing_code");
