-- Polki po zakaz: skidka sharti buzilganda / kamayganda «Долг скидка»
ALTER TABLE "sales_returns"
  ADD COLUMN IF NOT EXISTS "discount_debt_amount" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "discount_debt_note" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "discount_sum_after" DECIMAL(15,2);
