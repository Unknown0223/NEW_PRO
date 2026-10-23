-- Dostup «Сотрудники»: bitta xodim bir nechta foydalanuvchiga biriktirilishi mumkin.
CREATE TABLE IF NOT EXISTS "user_staff_links" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "staff_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_staff_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_staff_links_user_id_staff_user_id_key" ON "user_staff_links"("user_id", "staff_user_id");
CREATE INDEX IF NOT EXISTS "user_staff_links_tenant_id_staff_user_id_idx" ON "user_staff_links"("tenant_id", "staff_user_id");

ALTER TABLE "user_staff_links" ADD CONSTRAINT "user_staff_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_staff_links" ADD CONSTRAINT "user_staff_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_staff_links" ADD CONSTRAINT "user_staff_links_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
