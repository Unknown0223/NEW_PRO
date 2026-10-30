-- GPS ping: batareya % va tarmoq turi (GPS monitoring uchun)
ALTER TABLE "agent_location_pings" ADD COLUMN IF NOT EXISTS "battery_pct" INTEGER;
ALTER TABLE "agent_location_pings" ADD COLUMN IF NOT EXISTS "network_type" VARCHAR(16);
