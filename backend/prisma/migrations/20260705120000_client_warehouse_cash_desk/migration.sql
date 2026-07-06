-- Mijozga sklad va kassa bog‘lash (vizitlar rejasi / zona chegaralari)
ALTER TABLE "clients" ADD COLUMN "warehouse_id" INTEGER;
ALTER TABLE "clients" ADD COLUMN "cash_desk_id" INTEGER;

CREATE INDEX "clients_tenant_id_warehouse_id_idx" ON "clients"("tenant_id", "warehouse_id");
CREATE INDEX "clients_tenant_id_cash_desk_id_idx" ON "clients"("tenant_id", "cash_desk_id");

ALTER TABLE "clients" ADD CONSTRAINT "clients_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_cash_desk_id_fkey" FOREIGN KEY ("cash_desk_id") REFERENCES "cash_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
