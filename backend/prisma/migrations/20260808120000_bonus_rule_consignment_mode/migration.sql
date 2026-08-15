-- AlterTable
ALTER TABLE "bonus_rules" ADD COLUMN IF NOT EXISTS "consignment_mode" VARCHAR(8) NOT NULL DEFAULT 'all';
