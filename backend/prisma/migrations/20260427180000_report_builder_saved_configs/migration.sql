-- Report Builder: saved pivot/config per user
CREATE TABLE "report_builder_saved_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "dataset_id" VARCHAR(64) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_builder_saved_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_builder_saved_configs_tenant_id_user_id_idx" ON "report_builder_saved_configs"("tenant_id", "user_id");
CREATE INDEX "report_builder_saved_configs_tenant_id_user_id_updated_at_idx" ON "report_builder_saved_configs"("tenant_id", "user_id", "updated_at" DESC);

ALTER TABLE "report_builder_saved_configs" ADD CONSTRAINT "report_builder_saved_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_builder_saved_configs" ADD CONSTRAINT "report_builder_saved_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
