-- Prisma writes `entry_kind` (varchar); DB also requires `entry_kind_enum` (payment_kind_enum).

BEGIN;

UPDATE client_payments
SET entry_kind_enum = lower(trim(entry_kind))::payment_kind_enum
WHERE entry_kind_enum IS NULL
  AND entry_kind IS NOT NULL
  AND lower(trim(entry_kind)) IN ('payment', 'client_expense', 'refund');

CREATE OR REPLACE FUNCTION sync_client_payment_entry_kind_enum()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_kind IS NOT NULL THEN
    NEW.entry_kind_enum := lower(trim(NEW.entry_kind))::payment_kind_enum;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_payments_entry_kind_enum_sync ON client_payments;

CREATE TRIGGER client_payments_entry_kind_enum_sync
  BEFORE INSERT OR UPDATE OF entry_kind ON client_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_payment_entry_kind_enum();

COMMIT;
