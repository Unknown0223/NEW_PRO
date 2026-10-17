-- Profil rasmi: «Клиенты» dostup lentasidagi alohida o'zgartirish.
-- Yaratish yoki kartani tahrirlash ruxsati borlarga ham beriladi.

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT t."id",
       'clients.profil.update',
       'clients',
       'Клиенты',
       'update',
       'Клиенты / Клиенты / Фото профиля клиента',
       NOW()
FROM "tenants" t
ON CONFLICT ("tenant_id", "key") DO UPDATE
SET "description" = EXCLUDED."description",
    "section" = EXCLUDED."section",
    "action" = EXCLUDED."action",
    "updated_at" = NOW();

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", np."id"
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = 'clients.profil.update'
WHERE op."key" IN ('clients.klient.update', 'clients.klient.create')
ON CONFLICT DO NOTHING;

INSERT INTO "user_permissions" ("user_id", "permission_id", "effect")
SELECT DISTINCT ON (up."user_id", np."id") up."user_id", np."id", up."effect"
FROM "user_permissions" up
JOIN "permissions" op ON op."id" = up."permission_id"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = 'clients.profil.update'
WHERE op."key" IN ('clients.klient.update', 'clients.klient.create')
ORDER BY up."user_id", np."id", CASE WHEN up."effect" = 'deny' THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;
