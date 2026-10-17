-- Доступ → Клиенты → «Назначение визитов на карте»: bitta `clients.vizity.update` o'rniga
-- har bir tugma alohida operatsiya (agent, kunlar, ekspeditor, ombor, kassa). Eski kalit egalari
-- (rol va foydalanuvchi, deny ham) beshala yangi kalitni oladi, eski kalit o'chiriladi.

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key")
SELECT 'clients.vizity.update', n."new_key"
FROM (VALUES
  ('clients.vizity_agent.update'),
  ('clients.vizity_dni.update'),
  ('clients.vizity_ekspeditor.update'),
  ('clients.vizity_sklad.update'),
  ('clients.vizity_kassa.update')
) AS n("new_key");

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

DELETE FROM "permissions" WHERE "key" IN ('clients.vizity.update', 'access.grant.clients.vizity.update');

DROP TABLE "_perm_copy";
