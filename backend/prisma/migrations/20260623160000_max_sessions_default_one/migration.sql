-- Sessiya limiti standart qiymati: 2 -> 1 (har bir foydalanuvchiga 1 ta qurilma).
-- Qo'lda belgilash imkoniyati saqlanadi; admin login paytida limitdan ozod (kodda).
ALTER TABLE "users" ALTER COLUMN "max_sessions" SET DEFAULT 1;

-- Mavjud barcha foydalanuvchilarni yangi standartga keltiramiz ("hammada 1").
UPDATE "users" SET "max_sessions" = 1;
