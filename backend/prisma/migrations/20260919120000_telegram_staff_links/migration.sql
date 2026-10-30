-- Telegram bot: hodim ↔ unikal telegram_id
CREATE TABLE IF NOT EXISTS "telegram_staff_links" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "telegram_id" BIGINT NOT NULL,
  "bound_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "telegram_staff_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_staff_links_user_id_key" ON "telegram_staff_links"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_staff_links_telegram_id_key" ON "telegram_staff_links"("telegram_id");
CREATE INDEX IF NOT EXISTS "telegram_staff_links_tenant_id_idx" ON "telegram_staff_links"("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_staff_links_tenant_id_fkey'
  ) THEN
    ALTER TABLE "telegram_staff_links"
      ADD CONSTRAINT "telegram_staff_links_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_staff_links_user_id_fkey'
  ) THEN
    ALTER TABLE "telegram_staff_links"
      ADD CONSTRAINT "telegram_staff_links_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
