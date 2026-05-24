-- Keep order_type_enum in sync with varchar order_type (Prisma still writes order_type only).

CREATE OR REPLACE FUNCTION orders_sync_order_type_enum()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_type_enum IS NULL AND NEW.order_type IS NOT NULL THEN
    NEW.order_type_enum := lower(trim(NEW.order_type))::order_type_enum;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_sync_order_type_enum ON orders;

CREATE TRIGGER orders_sync_order_type_enum
  BEFORE INSERT OR UPDATE OF order_type, order_type_enum ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_sync_order_type_enum();

UPDATE orders
SET order_type_enum = lower(trim(order_type))::order_type_enum
WHERE order_type_enum IS NULL AND order_type IS NOT NULL;

ALTER TABLE orders
  ALTER COLUMN order_type_enum SET DEFAULT 'order'::order_type_enum;
