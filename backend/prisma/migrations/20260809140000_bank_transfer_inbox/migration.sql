-- Bank Transfer Inbox (универсальное перечисление)
CREATE TABLE IF NOT EXISTS "bank_transfer_inbox" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'unmatched',
    "source" VARCHAR(32) NOT NULL,
    "external_id" VARCHAR(128),
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'UZS',
    "paid_at" TIMESTAMP(3),
    "payer_name" TEXT,
    "payer_inn" VARCHAR(32),
    "payer_pinfl" VARCHAR(20),
    "payer_bank_account" VARCHAR(64),
    "payer_bank_mfo" VARCHAR(32),
    "payer_client_code" VARCHAR(32),
    "purpose" TEXT,
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "match_candidates" JSONB NOT NULL DEFAULT '[]',
    "match_field" VARCHAR(32),
    "matched_client_id" INTEGER,
    "assigned_client_id" INTEGER,
    "payment_id" INTEGER,
    "cash_desk_id" INTEGER,
    "ignored_at" TIMESTAMP(3),
    "ignored_by_user_id" INTEGER,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_transfer_inbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_transfer_inbox_tenant_id_source_external_id_key"
  ON "bank_transfer_inbox"("tenant_id", "source", "external_id");
CREATE INDEX IF NOT EXISTS "bank_transfer_inbox_tenant_id_status_idx"
  ON "bank_transfer_inbox"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "bank_transfer_inbox_tenant_id_paid_at_idx"
  ON "bank_transfer_inbox"("tenant_id", "paid_at" DESC);
CREATE INDEX IF NOT EXISTS "bank_transfer_inbox_tenant_id_payment_id_idx"
  ON "bank_transfer_inbox"("tenant_id", "payment_id");
CREATE INDEX IF NOT EXISTS "bank_transfer_inbox_tenant_id_assigned_client_id_idx"
  ON "bank_transfer_inbox"("tenant_id", "assigned_client_id");

CREATE TABLE IF NOT EXISTS "bank_transfer_inbox_events" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "inbox_id" INTEGER NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "comment" TEXT,
    "from_client_id" INTEGER,
    "to_client_id" INTEGER,
    "actor_user_id" INTEGER,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_transfer_inbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_transfer_inbox_events_tenant_id_inbox_id_created_at_idx"
  ON "bank_transfer_inbox_events"("tenant_id", "inbox_id", "created_at");

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_tenant_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_matched_client_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_matched_client_id_fkey"
  FOREIGN KEY ("matched_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_assigned_client_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_assigned_client_id_fkey"
  FOREIGN KEY ("assigned_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_payment_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_cash_desk_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_cash_desk_id_fkey"
  FOREIGN KEY ("cash_desk_id") REFERENCES "cash_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_created_by_user_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_ignored_by_user_id_fkey";
ALTER TABLE "bank_transfer_inbox"
  ADD CONSTRAINT "bank_transfer_inbox_ignored_by_user_id_fkey"
  FOREIGN KEY ("ignored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox_events" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_events_tenant_id_fkey";
ALTER TABLE "bank_transfer_inbox_events"
  ADD CONSTRAINT "bank_transfer_inbox_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox_events" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_events_inbox_id_fkey";
ALTER TABLE "bank_transfer_inbox_events"
  ADD CONSTRAINT "bank_transfer_inbox_events_inbox_id_fkey"
  FOREIGN KEY ("inbox_id") REFERENCES "bank_transfer_inbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_transfer_inbox_events" DROP CONSTRAINT IF EXISTS "bank_transfer_inbox_events_actor_user_id_fkey";
ALTER TABLE "bank_transfer_inbox_events"
  ADD CONSTRAINT "bank_transfer_inbox_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
