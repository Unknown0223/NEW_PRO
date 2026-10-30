-- Табель kunlik normasi: agentda konsignatsiya qaysi kunlari yoqilgan bo‘lganini bilish uchun tarix.
CREATE TABLE IF NOT EXISTS "user_consignment_logs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_consignment_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_consignment_logs_tenant_id_user_id_changed_at_idx"
    ON "user_consignment_logs"("tenant_id", "user_id", "changed_at");

ALTER TABLE "user_consignment_logs" ADD CONSTRAINT "user_consignment_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_consignment_logs" ADD CONSTRAINT "user_consignment_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Boshlang‘ich holat: hozirgi bayroq «azaldan shunday» deb olinadi.
INSERT INTO "user_consignment_logs" ("tenant_id", "user_id", "enabled", "changed_at")
SELECT u."tenant_id", u."id", u."consignment", TIMESTAMP '2000-01-01 00:00:00'
FROM "users" u
WHERE u."role" = 'agent' OR u."consignment" = true;

CREATE OR REPLACE FUNCTION "log_user_consignment_change"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."consignment" IS DISTINCT FROM OLD."consignment" THEN
    INSERT INTO "user_consignment_logs" ("tenant_id", "user_id", "enabled", "changed_at")
    VALUES (NEW."tenant_id", NEW."id", NEW."consignment", clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "users_consignment_log" ON "users";
CREATE TRIGGER "users_consignment_log"
AFTER INSERT OR UPDATE OF "consignment" ON "users"
FOR EACH ROW EXECUTE PROCEDURE "log_user_consignment_change"();
