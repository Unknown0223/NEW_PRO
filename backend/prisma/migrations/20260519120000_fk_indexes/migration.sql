-- FK Indexes Migration
-- Created: 2026-05-19
-- Purpose: Add foreign key indexes for common query patterns

-- ClientAgentAssignment indexes
CREATE INDEX IF NOT EXISTS idx_client_agent_assignments_agent_id
ON client_agent_assignments(agent_id);

CREATE INDEX IF NOT EXISTS idx_client_agent_assignments_expeditor
ON client_agent_assignments(expeditor_user_id);

-- WarehouseCorrection index
CREATE INDEX IF NOT EXISTS idx_warehouse_corrections_created_by
ON warehouse_corrections(created_by_user_id);

-- SlotAuditEntry indexes (table may not exist)
-- CREATE INDEX IF NOT EXISTS idx_slot_audit_entries_prev_user
-- ON slot_audit_entries(prev_user_id);
-- CREATE INDEX IF NOT EXISTS idx_slot_audit_entries_next_user
-- ON slot_audit_entries(next_user_id);

-- KpiResult index (table may not exist)
-- CREATE INDEX IF NOT EXISTS idx_kpi_results_kpi_group
-- ON kpi_results(kpi_group_id);

-- BonusRule active index
CREATE INDEX IF NOT EXISTS idx_bonus_rules_tenant_active
ON bonus_rules(tenant_id, is_active);