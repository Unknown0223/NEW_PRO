-- Per-user Face ID login gate + short-lived login challenges
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "require_face_login" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "face_login_challenges" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "channel" VARCHAR(16) NOT NULL DEFAULT 'webcam',
    "directions" JSONB NOT NULL DEFAULT '[]',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "face_login_challenges_token_hash_key"
    ON "face_login_challenges"("token_hash");

CREATE INDEX IF NOT EXISTS "face_login_challenges_tenant_id_user_id_status_created_at_idx"
    ON "face_login_challenges"("tenant_id", "user_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "face_login_challenges_expires_at_idx"
    ON "face_login_challenges"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'face_login_challenges_tenant_id_fkey'
  ) THEN
    ALTER TABLE "face_login_challenges"
      ADD CONSTRAINT "face_login_challenges_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'face_login_challenges_user_id_fkey'
  ) THEN
    ALTER TABLE "face_login_challenges"
      ADD CONSTRAINT "face_login_challenges_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
