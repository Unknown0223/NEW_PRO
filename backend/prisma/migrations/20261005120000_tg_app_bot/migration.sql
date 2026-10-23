CREATE TABLE IF NOT EXISTS "tg_client_links" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "client_id" INTEGER NOT NULL,
  "telegram_id" BIGINT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "phone" VARCHAR(32),
  "phone_match" BOOLEAN NOT NULL DEFAULT false,
  "code_id" INTEGER,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" INTEGER,
  "approved_at" TIMESTAMP(3),
  "revoked_by" INTEGER,
  "revoked_at" TIMESTAMP(3),
  "revoke_reason" VARCHAR(200),
  "last_seen_at" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "tg_client_links_tenant_id_client_id_telegram_id_key" ON "tg_client_links" ("tenant_id", "client_id", "telegram_id");
CREATE INDEX IF NOT EXISTS "tg_client_links_telegram_id_status_idx" ON "tg_client_links" ("telegram_id", "status");
CREATE INDEX IF NOT EXISTS "tg_client_links_tenant_id_client_id_status_idx" ON "tg_client_links" ("tenant_id", "client_id", "status");

CREATE TABLE IF NOT EXISTS "tg_link_codes" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "client_id" INTEGER NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
  "created_by" INTEGER,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "used_by_telegram_id" BIGINT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "tg_link_codes_code_hash_key" ON "tg_link_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "tg_link_codes_tenant_id_client_id_idx" ON "tg_link_codes" ("tenant_id", "client_id");

CREATE TABLE IF NOT EXISTS "tg_chats" (
  "telegram_id" BIGINT PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "chat_id" BIGINT NOT NULL,
  "screen_message_id" INTEGER,
  "state" JSONB NOT NULL DEFAULT '{}',
  "active_client_id" INTEGER,
  "lang" VARCHAR(4) NOT NULL DEFAULT 'uz',
  "notify_prefs" JSONB NOT NULL DEFAULT '{}',
  "junk" JSONB NOT NULL DEFAULT '[]',
  "blocked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tg_chats_tenant_id_idx" ON "tg_chats" ("tenant_id");

CREATE TABLE IF NOT EXISTS "tg_auth_attempts" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "telegram_id" BIGINT NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "reason" VARCHAR(64),
  "client_id" INTEGER,
  "user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tg_auth_attempts_telegram_id_created_at_idx" ON "tg_auth_attempts" ("telegram_id", "created_at");
CREATE INDEX IF NOT EXISTS "tg_auth_attempts_tenant_id_created_at_idx" ON "tg_auth_attempts" ("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "tg_notify_messages" (
  "id" SERIAL PRIMARY KEY,
  "telegram_id" BIGINT NOT NULL,
  "ref_key" VARCHAR(64) NOT NULL,
  "message_id" INTEGER NOT NULL,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "tg_notify_messages_telegram_id_ref_key_key" ON "tg_notify_messages" ("telegram_id", "ref_key");
