-- Har bir qurilma uchun barqaror sessiya identifikatori.
-- Bir xil qurilmadan qayta kirilganda o'sha qurilmaning eski sessiyasini
-- almashtirish (slot isrof bo'lmasligi) va "qaysi qurilma" kuzatuvi uchun.
ALTER TABLE "refresh_tokens" ADD COLUMN "device_id" VARCHAR(64);

CREATE INDEX "refresh_tokens_tenant_id_user_id_device_id_idx"
  ON "refresh_tokens" ("tenant_id", "user_id", "device_id");
