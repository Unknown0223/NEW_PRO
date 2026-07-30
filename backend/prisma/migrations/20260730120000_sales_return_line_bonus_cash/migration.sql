-- AlterTable
ALTER TABLE "sales_return_lines" ADD COLUMN IF NOT EXISTS "bonus_cash" DECIMAL(15,2);
