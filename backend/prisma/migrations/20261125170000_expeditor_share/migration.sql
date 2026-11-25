-- TezYuk Ulashish (Wave 2)
CREATE TABLE IF NOT EXISTS "expeditor_share_partners" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "owner_expeditor_user_id" INTEGER NOT NULL,
  "partner_expeditor_user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "expeditor_share_partners_tenant_owner_partner_key"
  ON "expeditor_share_partners" ("tenant_id", "owner_expeditor_user_id", "partner_expeditor_user_id");

CREATE INDEX IF NOT EXISTS "expeditor_share_partners_tenant_owner_idx"
  ON "expeditor_share_partners" ("tenant_id", "owner_expeditor_user_id");

CREATE TABLE IF NOT EXISTS "expeditor_share_requests" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "sender_user_id" INTEGER NOT NULL,
  "receiver_user_id" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'kutilmoqda',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "expeditor_share_requests_tenant_sender_status_idx"
  ON "expeditor_share_requests" ("tenant_id", "sender_user_id", "status");

CREATE INDEX IF NOT EXISTS "expeditor_share_requests_tenant_receiver_status_idx"
  ON "expeditor_share_requests" ("tenant_id", "receiver_user_id", "status");

CREATE TABLE IF NOT EXISTS "expeditor_share_orders" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "request_id" INTEGER NOT NULL,
  "order_id" INTEGER NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT false,
  "locked" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "expeditor_share_orders_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "expeditor_share_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "expeditor_share_orders_tenant_order_request_key"
  ON "expeditor_share_orders" ("tenant_id", "order_id", "request_id");

CREATE INDEX IF NOT EXISTS "expeditor_share_orders_tenant_order_locked_idx"
  ON "expeditor_share_orders" ("tenant_id", "order_id", "locked");

CREATE TABLE IF NOT EXISTS "expeditor_share_handoffs" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "request_id" INTEGER NOT NULL,
  "party" VARCHAR(16) NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "photo_key" VARCHAR(512),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expeditor_share_handoffs_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "expeditor_share_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "expeditor_share_handoffs_tenant_request_party_key"
  ON "expeditor_share_handoffs" ("tenant_id", "request_id", "party");
