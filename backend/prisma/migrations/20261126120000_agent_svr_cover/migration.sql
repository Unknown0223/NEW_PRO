-- Wave 3 MVP: agent ↔ SVR cover
CREATE TABLE IF NOT EXISTS "agent_svr_covers" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "agent_user_id" INTEGER NOT NULL,
  "svr_user_id" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'kutilmoqda',
  "cover_date" DATE NOT NULL,
  "requested_by_user_id" INTEGER NOT NULL,
  "agent_face_ok" BOOLEAN NOT NULL DEFAULT false,
  "svr_face_ok" BOOLEAN NOT NULL DEFAULT false,
  "accepted_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "agent_svr_covers_tenant_agent_date_idx"
  ON "agent_svr_covers" ("tenant_id", "agent_user_id", "cover_date");

CREATE INDEX IF NOT EXISTS "agent_svr_covers_tenant_svr_status_idx"
  ON "agent_svr_covers" ("tenant_id", "svr_user_id", "status");

-- Bir agent + kun uchun faqat bitta faol cover
CREATE UNIQUE INDEX IF NOT EXISTS "agent_svr_covers_active_uniq"
  ON "agent_svr_covers" ("tenant_id", "agent_user_id", "cover_date")
  WHERE "status" = 'faol';
