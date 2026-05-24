-- Keep status_enum in sync with varchar status (Prisma still writes status only).

CREATE OR REPLACE FUNCTION orders_sync_enum_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_type_enum IS NULL AND NEW.order_type IS NOT NULL THEN
    NEW.order_type_enum := lower(trim(NEW.order_type))::order_type_enum;
  END IF;
  IF NEW.status_enum IS NULL AND NEW.status IS NOT NULL THEN
    NEW.status_enum := lower(trim(NEW.status))::order_status_enum;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_sync_order_type_enum ON orders;
DROP TRIGGER IF EXISTS orders_sync_enum_columns ON orders;

CREATE TRIGGER orders_sync_enum_columns
  BEFORE INSERT OR UPDATE OF order_type, order_type_enum, status, status_enum ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_sync_enum_columns();

UPDATE orders
SET status_enum = lower(trim(status))::order_status_enum
WHERE status_enum IS NULL AND status IS NOT NULL;

ALTER TABLE orders
  ALTER COLUMN status_enum SET DEFAULT 'new'::order_status_enum;
