-- Hisobotlar: mahsulot kesimi bo‘yicha order_items qidiruv
CREATE INDEX IF NOT EXISTS "order_items_order_id_product_id_idx" ON "order_items" ("order_id", "product_id");
