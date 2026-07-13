-- Client: default price type + allow order when in debt
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "price_type" VARCHAR(128);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "allow_order_with_debt" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "clients_tenant_id_price_type_idx"
  ON "clients"("tenant_id", "price_type");

CREATE TABLE IF NOT EXISTS "client_tags" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_tags_tenant_id_name_key"
  ON "client_tags"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "client_tags_tenant_id_idx"
  ON "client_tags"("tenant_id");

ALTER TABLE "client_tags"
  DROP CONSTRAINT IF EXISTS "client_tags_tenant_id_fkey";
ALTER TABLE "client_tags"
  ADD CONSTRAINT "client_tags_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "client_tag_links" (
    "client_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_tag_links_pkey" PRIMARY KEY ("client_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "client_tag_links_tag_id_idx"
  ON "client_tag_links"("tag_id");

ALTER TABLE "client_tag_links"
  DROP CONSTRAINT IF EXISTS "client_tag_links_client_id_fkey";
ALTER TABLE "client_tag_links"
  ADD CONSTRAINT "client_tag_links_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_tag_links"
  DROP CONSTRAINT IF EXISTS "client_tag_links_tag_id_fkey";
ALTER TABLE "client_tag_links"
  ADD CONSTRAINT "client_tag_links_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "client_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
