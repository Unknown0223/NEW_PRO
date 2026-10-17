-- «Задачи»: mijozga bog'lash, bajarilish natijasi (izoh, rasmlar) va vaqtlari.
ALTER TABLE "tenant_tasks"
  ADD COLUMN "client_id" INTEGER,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "result_comment" TEXT,
  ADD COLUMN "result_photos" JSONB;

ALTER TABLE "tenant_tasks"
  ADD CONSTRAINT "tenant_tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tenant_tasks_tenant_id_due_at_idx" ON "tenant_tasks"("tenant_id", "due_at");

-- Доступ:
--   `staff.rabochie_dni.status` — dam olish kuni kirishni bloklash (rollar bo'yicha); avval `update` bilan edi.
--   `gps.marshrut.view` — «Маршрут дня агента» sahifasini ochish; `update` egalari oladi.
--   `staff.zadachi_spisok.*` — topshiriqlar ro'yxati: rahbar rollari (supervayzer, direktor, menejer...) oladi,
--   «Типы задач» ni ko'ra olganlar ro'yxatni ko'rish huquqini oladi.

CREATE TEMP TABLE "_perm_copy" (
  "old_key" VARCHAR(180) NOT NULL,
  "new_key" VARCHAR(180) NOT NULL
);

INSERT INTO "_perm_copy" ("old_key", "new_key") VALUES
  ('staff.rabochie_dni.update', 'staff.rabochie_dni.status'),
  ('gps.marshrut.update', 'gps.marshrut.view'),
  ('settings.tipy_zadach.view', 'staff.zadachi_spisok.view');

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

DROP TABLE "_perm_copy";

CREATE TEMP TABLE "_task_role_keys" ("role_key" VARCHAR(100) NOT NULL, "perm_key" VARCHAR(180) NOT NULL);

INSERT INTO "_task_role_keys" ("role_key", "perm_key")
SELECT r.role_key, k.perm_key
FROM (VALUES ('supervisor'), ('director'), ('manager'), ('sales_director'), ('regional_manager')) AS r(role_key)
CROSS JOIN (VALUES
  ('staff.zadachi_spisok.view'),
  ('staff.zadachi_spisok.create'),
  ('staff.zadachi_spisok.update'),
  ('staff.zadachi_spisok.delete'),
  ('staff.zadachi_spisok.export')
) AS k(perm_key);

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT DISTINCT ro."tenant_id", t."perm_key", 'staff', NULL, split_part(t."perm_key", '.', 3), NULL, NOW()
FROM "roles" ro
JOIN "_task_role_keys" t ON t."role_key" = ro."key"
ON CONFLICT ("tenant_id", "key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT ro."id", p."id"
FROM "roles" ro
JOIN "_task_role_keys" t ON t."role_key" = ro."key"
JOIN "permissions" p ON p."tenant_id" = ro."tenant_id" AND p."key" = t."perm_key"
ON CONFLICT DO NOTHING;

DROP TABLE "_task_role_keys";
