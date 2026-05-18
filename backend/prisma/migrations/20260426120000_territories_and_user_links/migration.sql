-- Hududlar moduli: Prisma `Territory` / `TerritoryUserLink` — avvalgi migratsiyalarda CREATE qoldirilgan,
-- shuning uchun `public.territories` yo‘q bazalarda GET /territories va bog‘liq API 503 berardi.

CREATE TABLE "territories" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "code" VARCHAR(64),
    "description" TEXT,
    "polygon" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" INTEGER,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "territory_user_links" (
    "id" SERIAL NOT NULL,
    "territory_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER,

    CONSTRAINT "territory_user_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "territories_tenant_id_code_key" ON "territories" ("tenant_id", "code");

CREATE INDEX "territories_tenant_id_idx" ON "territories" ("tenant_id");

CREATE INDEX "territories_tenant_id_deleted_at_idx" ON "territories" ("tenant_id", "deleted_at");

CREATE UNIQUE INDEX "territory_user_links_territory_id_user_id_key" ON "territory_user_links" ("territory_id", "user_id");

CREATE INDEX "territory_user_links_territory_id_idx" ON "territory_user_links" ("territory_id");

CREATE INDEX "territory_user_links_user_id_idx" ON "territory_user_links" ("user_id");

ALTER TABLE "territories" ADD CONSTRAINT "territories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "territories" ADD CONSTRAINT "territories_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "territory_user_links" ADD CONSTRAINT "territory_user_links_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "territories" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "territory_user_links" ADD CONSTRAINT "territory_user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "territory_user_links" ADD CONSTRAINT "territory_user_links_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
