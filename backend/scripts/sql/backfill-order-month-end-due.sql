-- Bir martalik: har bir buyurtmaning muddati — urilgan oyning oxirgi kuni (Toshkent).
UPDATE orders
SET consignment_due_date = (
  date_trunc('month', timezone('Asia/Tashkent', created_at))
  + interval '1 month'
  - interval '1 day'
) AT TIME ZONE 'Asia/Tashkent';
