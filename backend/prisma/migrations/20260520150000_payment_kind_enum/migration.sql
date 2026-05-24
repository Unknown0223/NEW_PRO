-- Migration: Add PaymentKind enum type
-- Created: 2026-05-20 15:00:00

BEGIN;

-- Create enum type if not exists
DO $$ BEGIN
  CREATE TYPE payment_kind_enum AS ENUM ('payment', 'client_expense', 'refund');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add temporary column
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS entry_kind_enum payment_kind_enum;

-- Copy data from string column to enum
UPDATE client_payments SET entry_kind_enum = lower(trim(entry_kind))::payment_kind_enum WHERE entry_kind IS NOT NULL;

-- Add check constraint
ALTER TABLE client_payments ADD CONSTRAINT client_payments_entry_kind_enum_check CHECK (entry_kind_enum IS NOT NULL);

-- Create index for entry_kind lookups
CREATE INDEX IF NOT EXISTS idx_client_payments_entry_kind_enum ON client_payments(entry_kind_enum);

COMMIT;