-- Offline enqueue payload dagi tip senani bo'sh payment_method_ref ga ko'chirish.
-- Yangi zakazlar create/enqueue da to'ldiriladi; bu faqat eski qatorlar uchun.

UPDATE "orders" o
SET "payment_method_ref" = LEFT(TRIM(l.payload->>'price_type'), 64)
FROM "order_change_logs" l
WHERE l.order_id = o.id
  AND l.action = 'offline_enqueue'
  AND (o.payment_method_ref IS NULL OR btrim(o.payment_method_ref) = '')
  AND NULLIF(TRIM(l.payload->>'price_type'), '') IS NOT NULL;
