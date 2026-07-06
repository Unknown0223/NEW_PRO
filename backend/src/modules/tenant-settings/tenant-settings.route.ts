import type { FastifyInstance } from "fastify";
import { registerTenantSettingsBonusRoutes } from "./tenant-settings.route.bonus";
import { registerTenantSettingsGeneralRoutes } from "./tenant-settings.route.general";

export async function registerTenantSettingsRoutes(app: FastifyInstance) {
  await registerTenantSettingsGeneralRoutes(app);
  await registerTenantSettingsBonusRoutes(app);
}
