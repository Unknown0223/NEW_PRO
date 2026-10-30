-- SalesDoc diler ichidagi raqam: f2- / f5- prefiksini olib tashlash.
-- Bir xil raqam har filialda alohida hujjat, shuning uchun unikallik ombor yoki kassa bilan.

DROP INDEX IF EXISTS "orders_tenant_id_number_key";
UPDATE "orders"
SET "number" = regexp_replace("number", '^f[0-9]+-', '')
WHERE "number" ~ '^f[0-9]+-';
CREATE UNIQUE INDEX "orders_tenant_id_warehouse_id_number_key"
  ON "orders" ("tenant_id", "warehouse_id", "number");

DROP INDEX IF EXISTS "sales_returns_tenant_id_number_key";
UPDATE "sales_returns"
SET "number" = regexp_replace("number", '^f[0-9]+-', '')
WHERE "number" ~ '^f[0-9]+-';
CREATE UNIQUE INDEX "sales_returns_tenant_id_warehouse_id_number_key"
  ON "sales_returns" ("tenant_id", "warehouse_id", "number");

DROP INDEX IF EXISTS "client_payments_tenant_id_number_key";
UPDATE "client_payments"
SET "number" = regexp_replace("number", '^f[0-9]+-', '')
WHERE "number" ~ '^f[0-9]+-';
CREATE UNIQUE INDEX "client_payments_tenant_id_cash_desk_id_number_key"
  ON "client_payments" ("tenant_id", "cash_desk_id", "number");

UPDATE "clients"
SET "client_code" = regexp_replace("client_code", '^f[0-9]+-', '')
WHERE "client_code" ~ '^f[0-9]+-';

UPDATE "users"
SET "code" = regexp_replace("code", '^f[0-9]+-', '')
WHERE "code" ~ '^f[0-9]+-';
