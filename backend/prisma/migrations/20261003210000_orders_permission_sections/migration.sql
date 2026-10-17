-- Доступ → Заявки: yon menyudagi har bir sahifa alohida bo'lim.
--   «Создать заказ» / «Создать возврат с полки» / «... по заказу» / «Создать обмен» — alohida `create`;
--   «Отказы» (`orders.otkazy`); «Автоматизация заявок» `automation.zaiavki` → `orders.avtomatizatsiya`
--   (o'chirish, tiklash, Excel, aktiv/deaktiv alohida); qaytarishni qabul qilish → «Возвратные накладные».
-- Eski kalit egalari (rol va foydalanuvchi, deny ham, «Может выдавать» ham) yangi kalitlarni oladi,
-- eski kalitlar o'chiriladi. `orders.zakaz.delete` hech narsani ochmasdi (zakaz faqat «Отменён» statusi).

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key") VALUES
  ('orders.zakaz.create', 'orders.sozdanie.create'),
  ('orders.vozvrat.create', 'orders.vozvrat_polki.create'),
  ('orders.vozvrat.create', 'orders.vozvrat_po_zakazu.create'),
  ('orders.vozvrat.view', 'invoices.vozvratnye.view'),
  ('orders.vozvrat.update', 'invoices.vozvratnye.approve'),
  ('orders.obmen_i_otkaz.view', 'orders.otkazy.view'),
  ('orders.obmen_i_otkaz.create', 'orders.obmen.create'),
  ('orders.obmen_i_otkaz.create', 'orders.otkazy.create'),
  ('orders.obmen_i_otkaz.update', 'orders.otkazy.create'),
  ('automation.zaiavki.view', 'orders.avtomatizatsiya.view'),
  ('automation.zaiavki.view', 'orders.avtomatizatsiya.copy'),
  ('automation.zaiavki.create', 'orders.avtomatizatsiya.create'),
  ('automation.zaiavki.update', 'orders.avtomatizatsiya.update'),
  ('automation.zaiavki.update', 'orders.avtomatizatsiya.delete'),
  ('automation.zaiavki.update', 'orders.avtomatizatsiya.restore'),
  ('automation.zaiavki.update', 'orders.avtomatizatsiya.activate'),
  ('automation.zaiavki.update', 'orders.avtomatizatsiya.deactivate');

-- «Может выдавать» (`access.grant.<kalit>`) ham ko'chadi.
INSERT INTO "_perm_copy" ("old_key", "new_key")
SELECT 'access.grant.' || "old_key", 'access.grant.' || "new_key" FROM "_perm_copy";

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT DISTINCT p."tenant_id",
       c."new_key",
       split_part(c."new_key", '.', 1),
       NULL,
       CASE WHEN c."new_key" LIKE 'access.grant.%' THEN NULL ELSE split_part(c."new_key", '.', 3) END,
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
ORDER BY up."user_id", np."id", CASE WHEN up."effect" = 'deny' THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;

DELETE FROM "permissions"
WHERE "key" IN (
  'orders.zakaz.create', 'orders.zakaz.delete',
  'orders.vozvrat.view', 'orders.vozvrat.create', 'orders.vozvrat.update', 'orders.vozvrat.history',
  'orders.obmen_i_otkaz.view', 'orders.obmen_i_otkaz.create', 'orders.obmen_i_otkaz.update',
  'automation.zaiavki.view', 'automation.zaiavki.create', 'automation.zaiavki.update'
)
OR "key" IN (
  'access.grant.orders.zakaz.create', 'access.grant.orders.zakaz.delete',
  'access.grant.orders.vozvrat.view', 'access.grant.orders.vozvrat.create',
  'access.grant.orders.vozvrat.update', 'access.grant.orders.vozvrat.history',
  'access.grant.orders.obmen_i_otkaz.view', 'access.grant.orders.obmen_i_otkaz.create',
  'access.grant.orders.obmen_i_otkaz.update',
  'access.grant.automation.zaiavki.view', 'access.grant.automation.zaiavki.create',
  'access.grant.automation.zaiavki.update'
);

DROP TABLE "_perm_copy";
