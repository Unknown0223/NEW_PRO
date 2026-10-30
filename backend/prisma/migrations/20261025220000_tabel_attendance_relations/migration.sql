-- Davomat jadvallariga Tenant/User/Location/Device FK. Avval yetim qatorlar tozalanadi.

UPDATE "attendance_punches" SET "location_id" = NULL
WHERE "location_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "attendance_locations" l WHERE l."id" = "attendance_punches"."location_id");
UPDATE "attendance_punches" SET "device_id" = NULL
WHERE "device_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "attendance_devices" d WHERE d."id" = "attendance_punches"."device_id");
UPDATE "attendance_punches" SET "kiosk_leader_id" = NULL
WHERE "kiosk_leader_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "attendance_punches"."kiosk_leader_id");
UPDATE "attendance_punches" SET "reviewed_by" = NULL
WHERE "reviewed_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "attendance_punches"."reviewed_by");
UPDATE "attendance_day_records" SET "override_by" = NULL
WHERE "override_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "attendance_day_records"."override_by");
UPDATE "staff_absence_requests" SET "approved_by" = NULL
WHERE "approved_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "staff_absence_requests"."approved_by");
UPDATE "staff_clearance_sheets" SET "approved_by" = NULL
WHERE "approved_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "staff_clearance_sheets"."approved_by");
UPDATE "attendance_devices" SET "location_id" = NULL
WHERE "location_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "attendance_locations" l WHERE l."id" = "attendance_devices"."location_id");

DELETE FROM "attendance_punches" p WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = p."tenant_id");
DELETE FROM "attendance_punches" p WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = p."user_id");
DELETE FROM "attendance_day_records" r WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = r."tenant_id");
DELETE FROM "attendance_day_records" r WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."user_id");
DELETE FROM "punch_day_codes" c WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = c."tenant_id");
DELETE FROM "punch_day_codes" c WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."user_id");
DELETE FROM "staff_absence_requests" a WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = a."tenant_id");
DELETE FROM "staff_absence_requests" a WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = a."user_id");
DELETE FROM "staff_clearance_sheets" s WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = s."tenant_id");
DELETE FROM "staff_clearance_sheets" s WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = s."user_id");
DELETE FROM "attendance_shifts" s WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = s."tenant_id");
DELETE FROM "attendance_locations" l WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = l."tenant_id");
DELETE FROM "attendance_devices" d WHERE NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = d."tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shifts_tenant_id_fkey') THEN
    ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_locations_tenant_id_fkey') THEN
    ALTER TABLE "attendance_locations" ADD CONSTRAINT "attendance_locations_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_tenant_id_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_user_id_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_location_id_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "attendance_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_device_id_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_device_id_fkey"
      FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_kiosk_leader_id_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_kiosk_leader_id_fkey"
      FOREIGN KEY ("kiosk_leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_reviewed_by_fkey') THEN
    ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_day_records_tenant_id_fkey') THEN
    ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_day_records_user_id_fkey') THEN
    ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_day_records_override_by_fkey') THEN
    ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_override_by_fkey"
      FOREIGN KEY ("override_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'punch_day_codes_tenant_id_fkey') THEN
    ALTER TABLE "punch_day_codes" ADD CONSTRAINT "punch_day_codes_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'punch_day_codes_user_id_fkey') THEN
    ALTER TABLE "punch_day_codes" ADD CONSTRAINT "punch_day_codes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_absence_requests_tenant_id_fkey') THEN
    ALTER TABLE "staff_absence_requests" ADD CONSTRAINT "staff_absence_requests_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_absence_requests_user_id_fkey') THEN
    ALTER TABLE "staff_absence_requests" ADD CONSTRAINT "staff_absence_requests_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_absence_requests_approved_by_fkey') THEN
    ALTER TABLE "staff_absence_requests" ADD CONSTRAINT "staff_absence_requests_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_clearance_sheets_tenant_id_fkey') THEN
    ALTER TABLE "staff_clearance_sheets" ADD CONSTRAINT "staff_clearance_sheets_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_clearance_sheets_user_id_fkey') THEN
    ALTER TABLE "staff_clearance_sheets" ADD CONSTRAINT "staff_clearance_sheets_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_clearance_sheets_approved_by_fkey') THEN
    ALTER TABLE "staff_clearance_sheets" ADD CONSTRAINT "staff_clearance_sheets_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_devices_tenant_id_fkey') THEN
    ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_devices_location_id_fkey') THEN
    ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "attendance_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
