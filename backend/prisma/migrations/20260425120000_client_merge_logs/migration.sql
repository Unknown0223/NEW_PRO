-- Birlashtirish jurnali (audit va «Объединённые» tab)

CREATE TABLE "client_merge_logs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "master_client_id" INTEGER NOT NULL,
    "merged_client_id" INTEGER NOT NULL,
    "merged_by_user_id" INTEGER,
    "merged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "client_merge_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_merge_logs_tenant_id_merged_at_idx" ON "client_merge_logs"("tenant_id", "merged_at" DESC);
CREATE INDEX "client_merge_logs_tenant_id_master_idx" ON "client_merge_logs"("tenant_id", "master_client_id");

ALTER TABLE "client_merge_logs" ADD CONSTRAINT "client_merge_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_merge_logs" ADD CONSTRAINT "client_merge_logs_master_client_id_fkey"
  FOREIGN KEY ("master_client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_merge_logs" ADD CONSTRAINT "client_merge_logs_merged_client_id_fkey"
  FOREIGN KEY ("merged_client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
