-- Vazvrat (sales_return) uchun zavsklad qabul bosqichi (acceptance gate).
-- Yangi vazvratlar `pending` holatda yaratiladi; qabul qilinganda side-effect'lar
-- (ombor ostatkasi, balans, bonus qarzi, manba zakaz belgilanishi) qo'llaniladi.

ALTER TABLE "sales_returns"
  ADD COLUMN "bonus_debt_amount" DECIMAL(15,2),
  ADD COLUMN "mirror_order_id" INTEGER,
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "accepted_by_user_id" INTEGER;

-- Mavjud yozuvlar allaqachon qo'llanilgan (posted) deb hisoblanadi.
UPDATE "sales_returns" SET "accepted_at" = "created_at" WHERE "status" = 'posted';
