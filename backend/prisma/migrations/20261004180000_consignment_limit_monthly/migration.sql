-- Konsignatsiya limiti oylar kesimida (eski oy limitini qayta qo‘yish uchun).
CREATE TABLE IF NOT EXISTS "consignment_limit_monthly" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "limit_amount" DECIMAL(15,2),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consignment_limit_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consignment_limit_monthly_tenant_id_user_id_year_month_key"
    ON "consignment_limit_monthly"("tenant_id", "user_id", "year", "month");
CREATE INDEX IF NOT EXISTS "consignment_limit_monthly_tenant_id_year_month_idx"
    ON "consignment_limit_monthly"("tenant_id", "year", "month");

-- Boshlang‘ich holat: joriy oy uchun hozirgi limitlar.
INSERT INTO "consignment_limit_monthly" ("tenant_id", "user_id", "year", "month", "limit_amount", "updated_at")
SELECT u."tenant_id", u."id",
       EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Tashkent'))::int,
       EXTRACT(MONTH FROM (now() AT TIME ZONE 'Asia/Tashkent'))::int,
       u."consignment_limit_amount", now()
FROM "users" u
WHERE u."role" = 'agent'
ON CONFLICT ("tenant_id", "user_id", "year", "month") DO NOTHING;

CREATE OR REPLACE FUNCTION "log_consignment_limit_monthly"() RETURNS trigger AS $$
DECLARE
  local_now TIMESTAMP := clock_timestamp() AT TIME ZONE 'Asia/Tashkent';
BEGIN
  IF NEW."role" = 'agent' AND (TG_OP = 'INSERT' OR NEW."consignment_limit_amount" IS DISTINCT FROM OLD."consignment_limit_amount") THEN
    INSERT INTO "consignment_limit_monthly" ("tenant_id", "user_id", "year", "month", "limit_amount", "updated_at")
    VALUES (NEW."tenant_id", NEW."id", EXTRACT(YEAR FROM local_now)::int, EXTRACT(MONTH FROM local_now)::int,
            NEW."consignment_limit_amount", clock_timestamp())
    ON CONFLICT ("tenant_id", "user_id", "year", "month")
    DO UPDATE SET "limit_amount" = EXCLUDED."limit_amount", "updated_at" = EXCLUDED."updated_at";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "users_consignment_limit_monthly" ON "users";
CREATE TRIGGER "users_consignment_limit_monthly"
AFTER INSERT OR UPDATE OF "consignment_limit_amount" ON "users"
FOR EACH ROW EXECUTE PROCEDURE "log_consignment_limit_monthly"();
