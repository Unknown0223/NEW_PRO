-- PaymentEditGrant: vaqtinchalik tahrirlash ruxsati
CREATE TABLE "payment_edit_grants" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "access_user_id" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "cancel_reason_ref" VARCHAR(128),
    "comment" VARCHAR(2000),
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_edit_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_edit_grants_tenant_id_payment_id_idx" ON "payment_edit_grants"("tenant_id", "payment_id");
CREATE INDEX "payment_edit_grants_tenant_id_status_idx" ON "payment_edit_grants"("tenant_id", "status");
CREATE INDEX "payment_edit_grants_tenant_id_created_at_idx" ON "payment_edit_grants"("tenant_id", "created_at" DESC);
CREATE INDEX "payment_edit_grants_tenant_id_expires_at_idx" ON "payment_edit_grants"("tenant_id", "expires_at");

ALTER TABLE "payment_edit_grants" ADD CONSTRAINT "payment_edit_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_edit_grants" ADD CONSTRAINT "payment_edit_grants_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "client_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_edit_grants" ADD CONSTRAINT "payment_edit_grants_access_user_id_fkey" FOREIGN KEY ("access_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_edit_grants" ADD CONSTRAINT "payment_edit_grants_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
