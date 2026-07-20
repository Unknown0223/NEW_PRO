-- WorkSlot workplace config (P0): joy sozlamalari slotda saqlanadi.
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "territory" TEXT;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "warehouse_id" INTEGER;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "return_warehouse_id" INTEGER;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "cash_desk_id" INTEGER;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "price_type" TEXT;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "price_types" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "entitlements" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment_limit_amount" DECIMAL(15,2);
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment_ignore_previous_months_debt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment_close_day" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment_close_hour" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "consignment_close_minute" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "supervisor_user_id" INTEGER;
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "warehouse_staff_entitlements" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "expeditor_assignment_rules" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "work_slots_warehouse_id_idx" ON "work_slots"("warehouse_id");
CREATE INDEX IF NOT EXISTS "work_slots_cash_desk_id_idx" ON "work_slots"("cash_desk_id");

DO $$ BEGIN
  ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_return_warehouse_id_fkey"
    FOREIGN KEY ("return_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_cash_desk_id_fkey"
    FOREIGN KEY ("cash_desk_id") REFERENCES "cash_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_supervisor_user_id_fkey"
    FOREIGN KEY ("supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
