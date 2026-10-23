-- «Отчёт → Дневные KPI планы»: alohida ruxsat (avval `plans.ustanovka_planov.view` ostida edi).
-- Hozir ko‘ra olayotgan rollar / foydalanuvchilar kirishni yo‘qotmasin.

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT DISTINCT p."tenant_id",
       'reports.dnevnye_kpi_plany.view',
       'reports',
       'Дневные KPI планы',
       'view',
       'Отчёт / Дневные KPI планы / Просмотр',
       NOW()
FROM "permissions" p
WHERE p."key" IN ('plans.ustanovka_planov.view', 'plans.ustanovka_planov.spisok_planov')
ON CONFLICT ("tenant_id", "key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", np."id"
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = 'reports.dnevnye_kpi_plany.view'
WHERE op."key" IN ('plans.ustanovka_planov.view', 'plans.ustanovka_planov.spisok_planov')
ON CONFLICT DO NOTHING;

INSERT INTO "user_permissions" ("user_id", "permission_id", "effect")
SELECT DISTINCT ON (up."user_id") up."user_id", np."id", up."effect"
FROM "user_permissions" up
JOIN "permissions" op ON op."id" = up."permission_id"
JOIN "permissions" np ON np."tenant_id" = op."tenant_id" AND np."key" = 'reports.dnevnye_kpi_plany.view'
WHERE op."key" IN ('plans.ustanovka_planov.view', 'plans.ustanovka_planov.spisok_planov')
ORDER BY up."user_id", CASE WHEN up."effect" = 'deny' THEN 0 ELSE 1 END
ON CONFLICT DO NOTHING;
