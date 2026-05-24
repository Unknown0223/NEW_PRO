-- Migration: Performance Indexes
-- Created: 2026-05-18
-- Purpose: Add performance indexes for common query patterns

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_supervisor_user_id ON users(supervisor_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_is_active ON users(tenant_id, is_active);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant_is_active_name ON products(tenant_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Payment allocations table indexes
CREATE INDEX IF NOT EXISTS idx_payment_allocations_order_id ON payment_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);

-- Additional indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_tenant_agent_status ON orders(tenant_id, agent_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_agent_id ON clients(tenant_id, agent_id);