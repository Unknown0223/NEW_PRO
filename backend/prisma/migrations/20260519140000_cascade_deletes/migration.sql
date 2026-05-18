-- Migration: Add CASCADE deletes for better referential integrity
-- Created: 2026-05-19 14:00:00

BEGIN;

-- Add CASCADE ON DELETE to foreign keys that don't have it

-- orders table: warehouse foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_warehouse_id_fkey_cascade'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS order_warehouse_id_fkey;
    ALTER TABLE orders ADD CONSTRAINT order_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- orders table: client foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_client_id_fkey_cascade'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS order_client_id_fkey;
    ALTER TABLE orders ADD CONSTRAINT order_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- order_items table: order foreign key (CASCADE)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey_cascade;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey_cascade
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- order_items table: product foreign key
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT;

-- payments table: order foreign key (CASCADE)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey_cascade;
ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey_cascade
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- payment_allocations table: payment foreign key (CASCADE)
ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_payment_id_fkey_cascade;
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_payment_id_fkey_cascade
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;

-- client_balance table: client foreign key (CASCADE)
ALTER TABLE client_balance DROP CONSTRAINT IF EXISTS client_balance_client_id_fkey_cascade;
ALTER TABLE client_balance ADD CONSTRAINT client_balance_client_id_fkey_cascade
  FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE CASCADE;

-- client_balance_movement table: client_balance foreign key (CASCADE)
ALTER TABLE client_balance_movement DROP CONSTRAINT IF EXISTS client_balance_movement_client_balance_id_fkey_cascade;
ALTER TABLE client_balance_movement ADD CONSTRAINT client_balance_movement_client_balance_id_fkey_cascade
  FOREIGN KEY (client_balance_id) REFERENCES client_balance(id) ON DELETE CASCADE;

-- client_agent_assignment table: client foreign key (CASCADE)
ALTER TABLE client_agent_assignment DROP CONSTRAINT IF EXISTS client_agent_assignment_client_id_fkey_cascade;
ALTER TABLE client_agent_assignment ADD CONSTRAINT client_agent_assignment_client_id_fkey_cascade
  FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE CASCADE;

-- client_agent_assignment table: agent foreign key
ALTER TABLE client_agent_assignment DROP CONSTRAINT IF EXISTS client_agent_assignment_agent_id_fkey;
ALTER TABLE client_agent_assignment ADD CONSTRAINT client_agent_assignment_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL;

-- visits table: client foreign key
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_client_id_fkey;
ALTER TABLE visits ADD CONSTRAINT visits_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE RESTRICT;

-- visits table: user foreign key (CASCADE)
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_user_id_fkey_cascade;
ALTER TABLE visits ADD CONSTRAINT visits_user_id_fkey_cascade
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;