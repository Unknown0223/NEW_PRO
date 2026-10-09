-- Доступ → Заявки → «Статус»: har bir status o'tishi alohida ruxsat.
-- Eski umumiy kalitlar (`orders.zakaz.status`, `orders.status.status`) egalari barcha yangi kalitlarni oladi
-- (deny bo'lsa — deny), so'ng eski kalitlar o'chiriladi.
-- Takror bo'limlar: `finance.obzor.view` → `dashboard.finansy.view`, `pivot.otchety.view` → `reports.konstruktor.view`
-- (faqat allow ko'chadi — eski deny ilgari faqat takror kalitni yopardi).
-- Yangi: `clients.obedinenie.update` (birlashtirish / saqlangan guruhlar) — `clients.obedinenie.view` egalariga.

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL,
  "copy_deny" BOOLEAN NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key", "copy_deny")
SELECT o."old_key", n."new_key", TRUE
FROM (VALUES ('orders.zakaz.status'), ('orders.status.status')) AS o("old_key")
CROSS JOIN (VALUES
  ('orders.status_confirmed.status'),
  ('orders.status_picking.status'),
  ('orders.status_delivering.status'),
  ('orders.status_delivered.status'),
  ('orders.status_returned.status'),
  ('orders.status_cancelled.status'),
  ('orders.status_revert.status'),
  ('orders.status_reopen.status'),
  ('orders.status_date.update')
) AS n("new_key");

INSERT INTO "_perm_copy" ("old_key", "new_key", "copy_deny") VALUES
  ('clients.obedinenie.view', 'clients.obedinenie.update', TRUE),
  ('finance.obzor.view', 'dashboard.finansy.view', FALSE),
  ('pivot.otchety.view', 'reports.konstruktor.view', FALSE);

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT DISTINCT p."tenant_id",
       c."new_key",
       split_part(c."new_key", '.', 1),
       NULL,
       split_part(c."new_key", '.', 3),
       NULL,
       NOW()
FROM "permissions" p
JOIN "_perm_copy" c ON c."old_key" = p."key"
ON CONFLICT ("tenant_id", "key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", np."id"
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id"
JOIN "_perm_copy" c ON c."old_key" = op."key"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = c."new_key"
ON CONFLICT DO NOTHING;

INSERT INTO "user_permissions" ("user_id", "permission_id", "effect")
SELECT DISTINCT ON (up."user_id", np."id") up."user_id", np."id", up."effect"
FROM "user_permissions" up
JOIN "permissions" op ON op."id" = up."permission_id"
JOIN "_perm_copy" c ON c."old_key" = op."key"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = c."new_key"
WHERE up."effect" <> 'deny' OR c."copy_deny"
ORDER BY up."user_id", np."id", CASE WHEN up."effect" = 'deny' THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;

-- Biriktirishlar (role/user) kaskad bilan o'chadi.
DELETE FROM "permissions"
WHERE "key" IN ('orders.zakaz.status', 'orders.status.status', 'finance.obzor.view', 'pivot.otchety.view');

DROP TABLE "_perm_copy";
