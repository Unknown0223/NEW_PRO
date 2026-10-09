-- Доступ → Клиенты: menyudagi har bir sahifa alohida bo'lim, ommaviy tahrir maydonlar bo'yicha.
-- `clients.klient.assign` (umumiy «групповая обработка») egalari barcha `clients.gr_*.update` va
-- `clients.vizity.update` ni oladi. Xarita / vizit rejasi / TT qoldiqlari ilgari boshqa kalitlar bilan
-- ochilardi (`clients.klient.view`, `gps.gps.view`, `warehouse.ostatki.view`) — o'sha egalarga ko'chadi.
-- Mavjud bo'lmagan amallar o'chiriladi: `clients.klient.delete` (mijoz o'chirilmaydi, faqat deaktivatsiya),
-- `clients.oborudovanie.update` (tahrir route'i yo'q).
-- `clients.obedinenie.update` 20261003120000 da ko'rish rollariga ham berilgan edi — ulardan olinadi.

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND p."key" = 'clients.obedinenie.update'
  AND r."key" IN (
    'director', 'sales_director', 'regional_manager', 'commercial_director', 'cashier', 'supervisor',
    'auditor', 'merchandiser', 'manager', 'partner'
  );

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key")
SELECT 'clients.klient.assign', n."new_key"
FROM (VALUES
  ('clients.gr_komanda.update'),
  ('clients.gr_territoriya.update'),
  ('clients.gr_kategoriya.update'),
  ('clients.gr_tip_format.update'),
  ('clients.gr_kanal.update'),
  ('clients.gr_sklad_kassa.update'),
  ('clients.gr_dolg.update'),
  ('clients.gr_kategoriya_tovara.update'),
  ('clients.gr_kredit_limit.update'),
  ('clients.gr_tip_tseny.update'),
  ('clients.gr_tegi.update'),
  ('clients.vizity.update')
) AS n("new_key");

INSERT INTO "_perm_copy" ("old_key", "new_key") VALUES
  ('clients.klient.view', 'clients.karta.view'),
  ('gps.gps.view', 'clients.vizity.view'),
  ('warehouse.ostatki.view', 'clients.ostatki_tt.view'),
  ('warehouse.ostatki.view', 'clients.ostatki_tt.copy'),
  ('warehouse.ostatki.view', 'clients.ostatki_tt.import'),
  ('clients.obedinenie.update', 'clients.obedinenie.create'),
  ('clients.obedinenie.update', 'clients.obedinenie.delete'),
  ('clients.obedinenie.update', 'clients.obedinenie.restore'),
  ('clients.obedinenie.view', 'clients.obedinenie.history');

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

-- Deny ham ko'chadi: ilgari shu kalit bilan yopilgan sahifa yangi kalit bilan ham yopiq qoladi.
INSERT INTO "user_permissions" ("user_id", "permission_id", "effect")
SELECT DISTINCT ON (up."user_id", np."id") up."user_id", np."id", up."effect"
FROM "user_permissions" up
JOIN "permissions" op ON op."id" = up."permission_id"
JOIN "_perm_copy" c ON c."old_key" = op."key"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = c."new_key"
ORDER BY up."user_id", np."id", CASE WHEN up."effect" = 'deny' THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;

-- Biriktirishlar (role/user) kaskad bilan o'chadi.
DELETE FROM "permissions"
WHERE "key" IN ('clients.klient.assign', 'clients.klient.delete', 'clients.oborudovanie.update');

DROP TABLE "_perm_copy";
