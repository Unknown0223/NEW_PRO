-- Agentlar o‘z yo‘nalishini `users.trade_direction_id` da saqlaydi;
-- `user_trade_directions` faqat veb «Доступ» scope (menejer, SVR, …) uchun.
DELETE FROM "user_trade_directions" utd
USING "users" u
WHERE utd.user_id = u.id
  AND u.role IN ('agent', 'expeditor', 'collector', 'auditor');
