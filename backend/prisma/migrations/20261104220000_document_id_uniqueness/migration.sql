-- Faol mijoz kodi, hodim kodi va zakaz qatori ikkinchi marta yozilmasin.
-- Filial ichidagi d0_1 / d0_4 ikki xil odam: kodga filial qo'shiladi.

UPDATE users SET code = 'f5-d0_1' WHERE login = 'sd-f5-d0_1' AND code = 'd0_1';
UPDATE users SET code = 'f2-d0_1' WHERE login = 'sd-f2-d0_1' AND code = 'd0_1';
UPDATE users SET code = 'f5-d0_4' WHERE login = 'sd-f5-d0_4' AND code = 'd0_4';
UPDATE users SET code = 'f2-d0_4' WHERE login = 'sd-f2-d0_4' AND code = 'd0_4';

WITH d AS (
  SELECT order_id, product_id, min(id) AS keep_id, sum(qty) AS qty
  FROM order_items
  WHERE is_bonus
  GROUP BY order_id, product_id
  HAVING count(*) > 1
)
UPDATE order_items i
SET qty = d.qty
FROM d
WHERE i.id = d.keep_id;

DELETE FROM order_items i
USING (
  SELECT id, row_number() OVER (PARTITION BY order_id, product_id ORDER BY id) AS n
  FROM order_items
  WHERE is_bonus
) d
WHERE i.id = d.id AND d.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS clients_active_code_uq
  ON clients (tenant_id, lower(btrim(client_code)))
  WHERE is_active
    AND merged_into_client_id IS NULL
    AND client_code IS NOT NULL
    AND btrim(client_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS users_code_uq
  ON users (tenant_id, lower(btrim(code)))
  WHERE code IS NOT NULL
    AND btrim(code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS order_items_product_line_uq
  ON order_items (order_id, product_id, is_bonus, (COALESCE(exchange_line_kind, '')));
