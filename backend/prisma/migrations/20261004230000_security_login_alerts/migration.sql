-- «Подозрительные входы»: kirishlar jurnali, ogohlantirishlar va ofis IP oq ro'yxati.
CREATE TABLE "auth_login_events" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "platform" VARCHAR(16) NOT NULL,
  "device_id" VARCHAR(64),
  "device_name" VARCHAR(255),
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_login_events_tenant_id_device_id_created_at_idx" ON "auth_login_events"("tenant_id", "device_id", "created_at");
CREATE INDEX "auth_login_events_tenant_id_ip_address_created_at_idx" ON "auth_login_events"("tenant_id", "ip_address", "created_at");
CREATE INDEX "auth_login_events_tenant_id_user_id_created_at_idx" ON "auth_login_events"("tenant_id", "user_id", "created_at");

ALTER TABLE "auth_login_events"
  ADD CONSTRAINT "auth_login_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "auth_login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_login_alerts" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "risk" VARCHAR(16) NOT NULL,
  "alert_key" VARCHAR(200) NOT NULL,
  "user_ids" INTEGER[],
  "details" JSONB NOT NULL DEFAULT '{}',
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_login_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_login_alerts_tenant_id_status_last_seen_at_idx" ON "security_login_alerts"("tenant_id", "status", "last_seen_at");
CREATE INDEX "security_login_alerts_tenant_id_kind_alert_key_idx" ON "security_login_alerts"("tenant_id", "kind", "alert_key");

ALTER TABLE "security_login_alerts"
  ADD CONSTRAINT "security_login_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_ip_whitelist" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "cidr" VARCHAR(64) NOT NULL,
  "label" VARCHAR(255),
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_ip_whitelist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_ip_whitelist_tenant_id_cidr_key" ON "security_ip_whitelist"("tenant_id", "cidr");

ALTER TABLE "security_ip_whitelist"
  ADD CONSTRAINT "security_ip_whitelist_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tarix: mavjud sessiyalardan har bir (foydalanuvchi, qurilma, IP) uchun birinchi kirish.
-- Shusiz deploydan keyingi birinchi kirishda hamma «новое устройство» bo'lib chiqardi.
INSERT INTO "auth_login_events" ("tenant_id", "user_id", "platform", "device_id", "device_name", "ip_address", "user_agent", "created_at")
SELECT rt."tenant_id",
       rt."user_id",
       CASE WHEN rt."user_agent" ILIKE 'Mozilla/%' THEN 'web' ELSE 'mobile' END,
       rt."device_id",
       LEFT(MAX(rt."device_name"), 255),
       rt."ip_address",
       MAX(rt."user_agent"),
       MIN(rt."created_at")
FROM "refresh_tokens" rt
GROUP BY rt."tenant_id", rt."user_id", rt."device_id", rt."ip_address",
         CASE WHEN rt."user_agent" ILIKE 'Mozilla/%' THEN 'web' ELSE 'mobile' END;

-- Доступ: `audit.podozritelnye_vhody.*` — direktor va auditor (ular «Аудит» modulini to'liq oladi).
CREATE TEMP TABLE "_sec_role_keys" ("role_key" VARCHAR(100) NOT NULL, "perm_key" VARCHAR(180) NOT NULL);

INSERT INTO "_sec_role_keys" ("role_key", "perm_key")
SELECT r.role_key, k.perm_key
FROM (VALUES ('director'), ('auditor')) AS r(role_key)
CROSS JOIN (VALUES
  ('audit.podozritelnye_vhody.view'),
  ('audit.podozritelnye_vhody.update'),
  ('audit.podozritelnye_vhody.create'),
  ('audit.podozritelnye_vhody.delete'),
  ('audit.podozritelnye_vhody.export')
) AS k(perm_key);

INSERT INTO "permissions" ("tenant_id", "key", "module", "section", "action", "description", "updated_at")
SELECT DISTINCT ro."tenant_id", t."perm_key", 'audit', NULL, split_part(t."perm_key", '.', 3), NULL, NOW()
FROM "roles" ro
JOIN "_sec_role_keys" t ON t."role_key" = ro."key"
ON CONFLICT ("tenant_id", "key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT ro."id", p."id"
FROM "roles" ro
JOIN "_sec_role_keys" t ON t."role_key" = ro."key"
JOIN "permissions" p ON p."tenant_id" = ro."tenant_id" AND p."key" = t."perm_key"
ON CONFLICT DO NOTHING;

DROP TABLE "_sec_role_keys";
