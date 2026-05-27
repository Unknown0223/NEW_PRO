-- Agent mijoz oldida «отказ» (buyurtmasiz) — «Отказы» sahifasi
CREATE TABLE "client_refusals" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "refusal_reason_ref" VARCHAR(128) NOT NULL,
    "territory" VARCHAR(128),
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_refusals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_refusals_tenant_id_created_at_idx"
  ON "client_refusals"("tenant_id", "created_at" DESC);

CREATE INDEX "client_refusals_tenant_id_agent_id_created_at_idx"
  ON "client_refusals"("tenant_id", "agent_id", "created_at" DESC);

CREATE INDEX "client_refusals_tenant_id_client_id_created_at_idx"
  ON "client_refusals"("tenant_id", "client_id", "created_at" DESC);

CREATE INDEX "client_refusals_tenant_id_refusal_reason_ref_idx"
  ON "client_refusals"("tenant_id", "refusal_reason_ref");

ALTER TABLE "client_refusals"
  ADD CONSTRAINT "client_refusals_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_refusals"
  ADD CONSTRAINT "client_refusals_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_refusals"
  ADD CONSTRAINT "client_refusals_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
