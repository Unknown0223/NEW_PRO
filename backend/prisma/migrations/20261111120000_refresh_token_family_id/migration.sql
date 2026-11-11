-- Refresh token oilasi: reuse aniqlanganda butun zanjir bekor qilinadi.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" VARCHAR(36);

-- Eski qatorlar: har biri o‘z oilasi (xavfsiz default).
UPDATE "refresh_tokens"
SET "family_id" = gen_random_uuid()::text
WHERE "family_id" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");
