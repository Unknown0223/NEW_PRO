-- Composite Indexes Migration
-- Created: 2026-05-19
-- Purpose: Add composite indexes for dashboard and report queries

-- BonusRule: active rules lookup by type
CREATE INDEX IF NOT EXISTS idx_bonus_rules_tenant_active_type
ON bonus_rules(tenant_id, is_active, type);

-- BonusRule: date range valid rules
CREATE INDEX IF NOT EXISTS idx_bonus_rules_tenant_active_dates
ON bonus_rules(tenant_id, is_active, valid_from, valid_to);

-- WarehouseCorrection: warehouse history
CREATE INDEX IF NOT EXISTS idx_warehouse_corrections_warehouse_created
ON warehouse_corrections(tenant_id, warehouse_id, created_at DESC);

-- SupplierPayment: supplier payment history
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_paid
ON supplier_payments(tenant_id, supplier_id, paid_at DESC);

-- GoodsReceipt: supplier receipts
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier_created
ON goods_receipts(tenant_id, supplier_id, created_at DESC);

-- ClientOpeningBalanceEntry: type filtering
CREATE INDEX IF NOT EXISTS idx_client_opening_balance_type
ON client_opening_balance_entries(tenant_id, balance_type, created_at DESC);

-- ClientEquipment: active equipment lookup (partial index)
CREATE INDEX IF NOT EXISTS idx_client_equipment_active
ON client_equipment(tenant_id)
WHERE removed_at IS NULL;

-- SalesReturn: warehouse history
CREATE INDEX IF NOT EXISTS idx_sales_returns_warehouse_created
ON sales_returns(tenant_id, warehouse_id, created_at DESC);

-- KpiResult: period+user queries (skip if table not yet created)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kpi_results'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_kpi_results_period_user
    ON kpi_results(tenant_id, period_month, user_id);
  END IF;
END $$;

-- AgentVisit: agent history
CREATE INDEX IF NOT EXISTS idx_agent_visits_agent_recorded
ON agent_visits(tenant_id, agent_id, checked_in_at DESC);

-- Expense: creator history
CREATE INDEX IF NOT EXISTS idx_expenses_created_by
ON expenses(tenant_id, created_by_user_id, created_at DESC);

-- ClientBalance: recent updates
CREATE INDEX IF NOT EXISTS idx_client_balances_updated
ON client_balances(tenant_id, updated_at DESC);