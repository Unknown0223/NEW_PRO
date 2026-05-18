-- Supervisor dashboard: tezroq kunlik reja / vizit / foto juftliklari
-- (getSupervisorDashboardSnapshot ichidagi katta SQL uchun)

-- Takrorlanuvchi reja: visit_date NULL + visit_weekdays @> [...]
CREATE INDEX IF NOT EXISTS "client_agent_assignments_tenant_visit_weekdays_gin_idx"
  ON "client_agent_assignments" USING GIN ("visit_weekdays")
  WHERE "visit_date" IS NULL;

-- Aniq sana rejasi: visit_date diapazoni
CREATE INDEX IF NOT EXISTS "client_agent_assignments_tenant_agent_visit_date_idx"
  ON "client_agent_assignments" ("tenant_id", "agent_id", "visit_date");

-- Kunlik vizitlar: agent bo‘yicha tez filtrlash
CREATE INDEX IF NOT EXISTS "agent_visits_tenant_agent_checked_in_at_idx"
  ON "agent_visits" ("tenant_id", "agent_id", "checked_in_at");

-- Kunlik foto hisobotlar: agent + vaqt
CREATE INDEX IF NOT EXISTS "client_photo_reports_tenant_creator_created_at_idx"
  ON "client_photo_reports" ("tenant_id", "created_by_user_id", "created_at");
