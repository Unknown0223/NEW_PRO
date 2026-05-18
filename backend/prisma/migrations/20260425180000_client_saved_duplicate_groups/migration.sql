-- Saqlangan dublikat guruhlari («Сохранённые» tab)

CREATE TABLE "client_saved_duplicate_groups" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "master_client_id" INTEGER NOT NULL,
    "client_ids" INTEGER[] NOT NULL,
    "note" VARCHAR(2000),
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_saved_duplicate_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_saved_duplicate_groups_tenant_created_idx"
  ON "client_saved_duplicate_groups"("tenant_id", "created_at" DESC);

ALTER TABLE "client_saved_duplicate_groups" ADD CONSTRAINT "client_saved_duplicate_groups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_saved_duplicate_groups" ADD CONSTRAINT "client_saved_duplicate_groups_master_client_id_fkey"
  FOREIGN KEY ("master_client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_saved_duplicate_groups" ADD CONSTRAINT "client_saved_duplicate_groups_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
