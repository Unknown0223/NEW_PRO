CREATE TABLE "user_trade_directions" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "trade_direction_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_trade_directions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_trade_directions_tenant_id_user_id_trade_direction_id_key"
    ON "user_trade_directions"("tenant_id", "user_id", "trade_direction_id");
CREATE INDEX "user_trade_directions_tenant_id_trade_direction_id_idx"
    ON "user_trade_directions"("tenant_id", "trade_direction_id");
CREATE INDEX "user_trade_directions_user_id_idx" ON "user_trade_directions"("user_id");

ALTER TABLE "user_trade_directions"
    ADD CONSTRAINT "user_trade_directions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trade_directions"
    ADD CONSTRAINT "user_trade_directions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trade_directions"
    ADD CONSTRAINT "user_trade_directions_trade_direction_id_fkey"
    FOREIGN KEY ("trade_direction_id") REFERENCES "trade_directions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_trade_directions" ("tenant_id", "user_id", "trade_direction_id", "created_at")
SELECT "tenant_id", "id", "trade_direction_id", NOW()
FROM "users"
WHERE "trade_direction_id" IS NOT NULL
ON CONFLICT DO NOTHING;
