-- Migration: Add OrderStatus enum type
-- Created: 2026-05-20 13:00:00

BEGIN;

-- Create enum type if not exists
DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('new', 'confirmed', 'assembling', 'shipped', 'delivering', 'delivered', 'cancelled', 'returned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add temporary column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_enum order_status_enum;

-- Copy data from string column to enum
UPDATE orders SET status_enum = lower(trim(status))::order_status_enum WHERE status IS NOT NULL;

-- Add check constraint
ALTER TABLE orders ADD CONSTRAINT orders_status_enum_check CHECK (status_enum IS NOT NULL);

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_orders_status_enum ON orders(status_enum);

COMMIT;