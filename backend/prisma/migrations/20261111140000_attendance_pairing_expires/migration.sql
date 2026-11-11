-- P1-5: pairing faqat qisqa TTL bilan bog‘lash uchun
ALTER TABLE "attendance_devices" ADD COLUMN IF NOT EXISTS "pairing_expires_at" TIMESTAMP(3);
