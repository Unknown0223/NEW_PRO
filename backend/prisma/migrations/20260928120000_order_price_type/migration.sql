-- Zakazda tanlangan narx turi (avval faqat payment_method_ref orqali taxmin qilinardi)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "price_type" VARCHAR(128);
