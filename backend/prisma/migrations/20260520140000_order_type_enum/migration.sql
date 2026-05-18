-- Migration: Add OrderType enum type
-- Created: 2026-05-20 14:00:00

BEGIN;

-- Create enum type if not exists
DO $$ BEGIN
  CREATE TYPE order_type_enum AS ENUM ('order', 'preorder', 'exchange', 'return');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add temporary column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type_enum order_type_enum;

-- Copy data from string column to enum
UPDATE orders SET order_type_enum = lower(trim(order_type))::order_type_enum WHERE order_type IS NOT NULL;

-- Add check constraint
ALTER TABLE orders ADD CONSTRAINT orders_order_type_enum_check CHECK (order_type_enum IS NOT NULL);

-- Create index for order_type lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_type_enum ON orders(order_type_enum);

COMMIT;