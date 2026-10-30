-- Доступ: bo'limlarni aniqroq ajratish (grantlar yangi kalitlarga ko'chadi, eski kalitlar o'chiriladi).
--   Склады: «Удалить» → «Деактивировать» va «Активировать» alohida.
--   Консигнация: «Создать» o'rniga «Статус», «Импорт» va «Время автозакрытия».
--   «Бонусы и скидки» → «Бонусы», «Скидки» va «Стратегии».
--   Отчёт → «Отчеты» → har bir hisobot sahifasi (ko'rish + Excel) alohida.
--   Конструктор: «Копировать» → «Excel», yangi «Удалить» va «Отправить другим».
--   GPS («GPS» va «Маршруты» ichidagi takror) → rollar bo'yicha monitoring, trek va kunlik marshrut.
--   Табель → «Рабочие дни» alohida (view/update/create/delete/history), «Аудит табеля» alohida.
--   Мобильное приложение, Период редактирования, Границы на карте: yangi amallar.
-- Rol, foydalanuvchi (deny ham) va «Может выдавать» (`access.grant.*`) ko'chadi.

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key") VALUES
  ('warehouse.sklady.delete', 'warehouse.sklady.deactivate'),
  ('warehouse.sklady.delete', 'warehouse.sklady.activate'),
  ('warehouse.sklady.update', 'warehouse.sklady.activate'),

  ('staff.konsignatsiya.create', 'staff.konsignatsiya.update'),
  ('staff.konsignatsiya.create', 'staff.konsignatsiya.status'),
  ('staff.konsignatsiya.create', 'staff.konsignatsiya.import'),
  ('staff.konsignatsiya.create', 'staff.konsignatsiya_zakrytie.update'),
  ('staff.konsignatsiya.update', 'staff.konsignatsiya.status'),
  ('staff.konsignatsiya.update', 'staff.konsignatsiya.import'),
  ('staff.konsignatsiya.update', 'staff.konsignatsiya_zakrytie.update'),

  ('settings.bonusy_i_skidki.view', 'settings.bonusy.view'),
  ('settings.bonusy_i_skidki.view', 'settings.skidki.view'),
  ('settings.bonusy_i_skidki.view', 'settings.bonus_strategiya.view'),
  ('settings.bonusy_i_skidki.create', 'settings.bonusy.create'),
  ('settings.bonusy_i_skidki.create', 'settings.skidki.create'),
  ('settings.bonusy_i_skidki.create', 'settings.bonus_strategiya.create'),
  ('settings.bonusy_i_skidki.update', 'settings.bonusy.update'),
  ('settings.bonusy_i_skidki.update', 'settings.skidki.update'),
  ('settings.bonusy_i_skidki.update', 'settings.bonus_strategiya.update'),
  ('settings.bonusy_i_skidki.delete', 'settings.bonusy.delete'),
  ('settings.bonusy_i_skidki.delete', 'settings.skidki.delete'),
  ('settings.bonusy_i_skidki.delete', 'settings.bonus_strategiya.delete'),
  ('settings.bonusy_i_skidki.export', 'settings.bonusy.export'),
  ('settings.bonusy_i_skidki.export', 'settings.skidki.export'),
  ('settings.bonusy_i_skidki.history', 'settings.bonusy.history'),
  ('settings.bonusy_i_skidki.history', 'settings.skidki.history'),

  ('reports.otchety.view', 'reports.zakazy_agentov.view'),
  ('reports.otchety.view', 'reports.gps.view'),
  ('reports.otchety.view', 'reports.prodazhi_klientov_2.view'),
  ('reports.otchety.view', 'reports.prodazhi_klientov_4.view'),
  ('reports.otchety.view', 'reports.prodazhi_tovarov.view'),
  ('reports.otchety.view', 'reports.vozvrat_ekspeditora.view'),
  ('reports.otchety.view', 'reports.vizity.view'),
  ('reports.otchety.view', 'reports.itogi_vizitov.view'),
  ('reports.otchety.view', 'reports.konstruktor.view'),
  ('reports.otchety.copy', 'reports.gps.export'),
  ('reports.otchety.copy', 'reports.prodazhi_klientov_2.export'),
  ('reports.otchety.copy', 'reports.prodazhi_klientov_4.export'),
  ('reports.otchety.copy', 'reports.prodazhi_tovarov.export'),
  ('reports.otchety.copy', 'reports.vozvrat_ekspeditora.export'),
  ('reports.otchety.copy', 'reports.vizity.export'),
  ('reports.otchety.copy', 'reports.itogi_vizitov.export'),
  ('reports.otchety.copy', 'reports.konstruktor.export'),

  ('reports.konstruktor.copy', 'reports.konstruktor.export'),
  ('reports.konstruktor.update', 'reports.konstruktor.delete'),
  ('reports.konstruktor.update', 'reports.konstruktor.transfer'),

  ('gps.gps.view', 'gps.agenty.view'),
  ('gps.gps.view', 'gps.dostavshchiki.view'),
  ('gps.gps.view', 'gps.supervayzery.view'),
  ('gps.gps.view', 'gps.inkassatory.view'),
  ('gps.gps.view', 'gps.van_selling.view'),
  ('gps.gps.view', 'gps.trek.view'),
  ('gps.gps.view', 'reports.gps.view'),
  ('gps.gps.export', 'gps.agenty.export'),
  ('gps.gps.export', 'gps.dostavshchiki.export'),
  ('gps.gps.export', 'gps.supervayzery.export'),
  ('gps.gps.export', 'gps.inkassatory.export'),
  ('gps.gps.export', 'gps.van_selling.export'),
  ('gps.gps.export', 'reports.gps.export'),
  ('gps.gps.update', 'gps.marshrut.update'),
  ('routes.marshruty.update', 'gps.marshrut.update'),
  ('routes.marshruty.view', 'gps.agenty.view'),
  ('routes.marshruty.view', 'gps.dostavshchiki.view'),
  ('routes.marshruty.view', 'gps.supervayzery.view'),
  ('routes.marshruty.view', 'gps.inkassatory.view'),
  ('routes.marshruty.view', 'gps.van_selling.view'),
  ('routes.marshruty.view', 'gps.trek.view'),
  ('routes.trek.view', 'gps.agenty.view'),
  ('routes.trek.view', 'gps.dostavshchiki.view'),
  ('routes.trek.view', 'gps.supervayzery.view'),
  ('routes.trek.view', 'gps.inkassatory.view'),
  ('routes.trek.view', 'gps.van_selling.view'),
  ('routes.trek.view', 'gps.trek.view'),

  ('staff.tabel.create', 'staff.tabel.update'),
  ('staff.tabel.create', 'staff.rabochie_dni.update'),
  ('staff.tabel.create', 'staff.rabochie_dni.create'),
  ('staff.tabel.update', 'staff.rabochie_dni.update'),
  ('staff.tabel.update', 'staff.rabochie_dni.create'),
  ('staff.tabel.update', 'staff.rabochie_dni.delete'),
  ('staff.tabel.view', 'staff.rabochie_dni.view'),
  ('staff.tabel.view', 'audit.tabel.view'),
  ('staff.tabel.history', 'staff.rabochie_dni.history'),
  ('audit.log.view', 'audit.tabel.view'),

  ('staff.zadachi.view', 'settings.tipy_zadach.view'),

  ('settings.mobile_app.update', 'settings.mobile_app.import'),
  ('settings.mobile_app.update', 'settings.mobile_app.transfer'),
  ('settings.document_edit_lock.update', 'settings.document_edit_lock.assign'),
  ('settings.geo_granitsy.update', 'settings.geo_granitsy.void'),
  ('settings.geo_granitsy.update', 'settings.geo_granitsy.assign');

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

CREATE TEMP TABLE "_perm_drop" ("key" VARCHAR(180) NOT NULL);

INSERT INTO "_perm_drop" ("key") VALUES
  ('warehouse.sklady.delete'),
  ('staff.konsignatsiya.create'),
  ('settings.bonusy_i_skidki.view'),
  ('settings.bonusy_i_skidki.create'),
  ('settings.bonusy_i_skidki.update'),
  ('settings.bonusy_i_skidki.delete'),
  ('settings.bonusy_i_skidki.export'),
  ('settings.bonusy_i_skidki.history'),
  ('reports.otchety.view'),
  ('reports.otchety.copy'),
  ('reports.konstruktor.copy'),
  ('gps.gps.view'),
  ('gps.gps.update'),
  ('gps.gps.export'),
  ('routes.marshruty.view'),
  ('routes.marshruty.update'),
  ('routes.trek.view'),
  ('staff.tabel.create');

INSERT INTO "_perm_drop" ("key")
SELECT 'access.grant.' || "key" FROM "_perm_drop";

DELETE FROM "role_permissions"
WHERE "permission_id" IN (SELECT p."id" FROM "permissions" p JOIN "_perm_drop" d ON d."key" = p."key");

DELETE FROM "user_permissions"
WHERE "permission_id" IN (SELECT p."id" FROM "permissions" p JOIN "_perm_drop" d ON d."key" = p."key");

DELETE FROM "permissions"
WHERE "key" IN (SELECT "key" FROM "_perm_drop");

DROP TABLE "_perm_drop";
DROP TABLE "_perm_copy";
