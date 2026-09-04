-- Persist where the order was created (mobile app vs web). List UI used to infer
-- from the first *status change* actor, so a web cancel marked an app order as «Веб».

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "creation_channel" VARCHAR(16);

UPDATE "orders" o
SET "creation_channel" = CASE
  WHEN lower(COALESCE(u.role, '')) LIKE '%agent%' OR lower(COALESCE(u.role, '')) LIKE '%expeditor%'
    THEN 'mobile'
    ELSE 'web'
END
FROM "tenant_audit_events" a
LEFT JOIN "users" u ON u.id = a.actor_user_id
WHERE a.tenant_id = o.tenant_id
  AND a.entity_type = 'order'
  AND a.action = 'order.create'
  AND a.entity_id = o.id::text
  AND o.creation_channel IS NULL;
