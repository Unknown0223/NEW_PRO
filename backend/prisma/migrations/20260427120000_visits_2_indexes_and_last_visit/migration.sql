-- «По визитам 2.0» — agent_visits qidiruv + clients.last_visit_at kesh maydoni
CREATE INDEX IF NOT EXISTS "agent_visits_tenant_id_client_id_checked_in_at_idx"
  ON "agent_visits" ("tenant_id", "client_id", "checked_in_at" DESC);

ALTER TABLE "clients" ADD COLUMN "last_visit_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "clients_tenant_id_last_visit_at_idx"
  ON "clients" ("tenant_id", "last_visit_at" DESC);
