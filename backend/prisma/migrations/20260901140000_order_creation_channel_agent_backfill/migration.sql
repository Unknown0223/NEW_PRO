-- Audit yo‘q qatorlar: biriktirilgan agent/ekspeditor — odatda ilova.
-- (Avvalgi migratsiya faqat order.create auditidan to‘ldirgan.)

UPDATE "orders" o
SET "creation_channel" = CASE
  WHEN lower(COALESCE(u.role, '')) LIKE '%agent%' OR lower(COALESCE(u.role, '')) LIKE '%expeditor%'
    THEN 'mobile'
    ELSE 'web'
END
FROM "users" u
WHERE o.agent_id = u.id
  AND o.creation_channel IS NULL;

UPDATE "orders"
SET "creation_channel" = 'web'
WHERE "creation_channel" IS NULL;
