-- Доступ → Касса → Кассы: «Создать кассу» va «Изменить кассу» alohida.
--   `cash.kassa.create` egalari `update` va `status` oladi (avval yaratish ruxsati tahrir va smena
--   ochish/yopishni ham ochardi); `create`/`history` egalari `export` oladi (avvalgi Excel shartlari).
-- Har bir ro'yxat / jadval bo'limida Excel yuklab olish alohida ruxsat (`<modul>.<bo'lim>.export`):
--   avval Excel ro'yxatni ko'rish bilan birga edi — `view` egalari `export` oladi.
--   Xodimlar va «Склады»: avval Excel `history` yoki `copy` bilan ochilardi — o'shalar `export` oladi.
--   `staff.agent.copy` → `staff.agent.export` (eski kalit o'chiriladi).
-- Rol, foydalanuvchi (deny ham) va «Может выдавать» (`access.grant.*`) ko'chadi.

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key") VALUES
  ('cash.kassa.create', 'cash.kassa.update'),
  ('cash.kassa.create', 'cash.kassa.status'),
  ('cash.kassa.create', 'cash.kassa.export'),
  ('cash.kassa.history', 'cash.kassa.export'),

  ('cash.balansy_klientov.view', 'cash.balansy_klientov.export'),
  ('cash.balansy_klientov.copy', 'cash.balansy_klientov.export'),
  ('cash.otchety.view', 'cash.otchety.export'),
  ('cash.kurs_valyuty.view', 'cash.kurs_valyuty.export'),
  ('cash.zayavki_na_oplatu.view', 'cash.zayavki_na_oplatu.export'),

  ('warehouse.sklady.history', 'warehouse.sklady.export'),
  ('warehouse.sklady.copy', 'warehouse.sklady.export'),
  ('warehouse.bloki.view', 'warehouse.bloki.export'),
  ('warehouse.postuplenie.view', 'warehouse.postuplenie.export'),
  ('warehouse.peremeshchenie.view', 'warehouse.peremeshchenie.export'),
  ('warehouse.korrektirovka.view', 'warehouse.korrektirovka.export'),
  ('warehouse.rekomendovannyy_zapas.view', 'warehouse.rekomendovannyy_zapas.export'),
  ('warehouse.materialnyy_otchet.view', 'warehouse.materialnyy_otchet.export'),

  ('clients.oborudovanie.view', 'clients.oborudovanie.export'),

  ('suppliers.postavshchik.view', 'suppliers.postavshchik.export'),
  ('suppliers.oplaty.view', 'suppliers.oplaty.export'),
  ('suppliers.balansy.view', 'suppliers.balansy.export'),

  ('reports.dnevnye_kpi_plany.view', 'reports.dnevnye_kpi_plany.export'),

  ('staff.agent.copy', 'staff.agent.export'),
  ('staff.agent.history', 'staff.agent.export'),
  ('staff.ekspeditor.history', 'staff.ekspeditor.export'),
  ('staff.ekspeditor.copy', 'staff.ekspeditor.export'),
  ('staff.supervayzer.history', 'staff.supervayzer.export'),
  ('staff.supervayzer.copy', 'staff.supervayzer.export'),
  ('staff.skladchik.history', 'staff.skladchik.export'),
  ('staff.skladchik.copy', 'staff.skladchik.export'),
  ('staff.inkassator.history', 'staff.inkassator.export'),
  ('staff.inkassator.copy', 'staff.inkassator.export'),
  ('staff.auditor.history', 'staff.auditor.export'),
  ('staff.auditor.copy', 'staff.auditor.export'),
  ('staff.sotrudniki.history', 'staff.sotrudniki.export'),
  ('staff.sotrudniki.copy', 'staff.sotrudniki.export'),
  ('staff.konsignatsiya.view', 'staff.konsignatsiya.export'),
  ('staff.tabel.view', 'staff.tabel.export'),

  ('gps.gps.view', 'gps.gps.export'),
  ('work_slots.raboche_mesto.view', 'work_slots.raboche_mesto.export'),

  ('dashboard.prodazhi.view', 'dashboard.prodazhi.export'),
  ('dashboard.finansy.view', 'dashboard.finansy.export'),
  ('dashboard.supervayzer.view', 'dashboard.supervayzer.export'),

  ('settings.kategoriya_tovara.view', 'settings.kategoriya_tovara.export'),
  ('settings.kanal_sbyta.view', 'settings.kanal_sbyta.export'),
  ('settings.napravlenie_torgovli.view', 'settings.napravlenie_torgovli.export'),
  ('settings.bonusy_i_skidki.view', 'settings.bonusy_i_skidki.export'),
  ('settings.orders_consignment.view', 'settings.orders_consignment.export'),
  ('settings.initial_setup.view', 'settings.initial_setup.export'),

  ('audit.log.view', 'audit.log.export'),
  ('diagnostics.error_logs.view', 'diagnostics.error_logs.export'),
  ('activity.history.view', 'activity.history.export'),
  ('access.upravlenie.view', 'access.upravlenie.export');

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
WHERE "key" IN ('staff.agent.copy', 'access.grant.staff.agent.copy');

DROP TABLE "_perm_copy";
