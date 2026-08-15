-- DocumentEditGrant: bo‘lim + hujjat + user uchun vaqtinchalik yozish ruxsati
CREATE TABLE "document_edit_grants" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "section" VARCHAR(32) NOT NULL,
    "document_id" INTEGER NOT NULL,
    "document_kind" VARCHAR(32),
    "access_user_id" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "comment" VARCHAR(2000),
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_edit_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_edit_grants_tenant_id_section_document_id_idx"
  ON "document_edit_grants"("tenant_id", "section", "document_id");
CREATE INDEX "document_edit_grants_tenant_id_status_expires_at_idx"
  ON "document_edit_grants"("tenant_id", "status", "expires_at");
CREATE INDEX "document_edit_grants_tenant_id_access_user_id_idx"
  ON "document_edit_grants"("tenant_id", "access_user_id");
CREATE INDEX "document_edit_grants_tenant_id_created_at_idx"
  ON "document_edit_grants"("tenant_id", "created_at" DESC);

ALTER TABLE "document_edit_grants"
  ADD CONSTRAINT "document_edit_grants_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_edit_grants"
  ADD CONSTRAINT "document_edit_grants_access_user_id_fkey"
  FOREIGN KEY ("access_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_edit_grants"
  ADD CONSTRAINT "document_edit_grants_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
