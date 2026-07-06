import type { FastifyInstance } from "fastify";
import { registerMobileAgentRoutes } from "./mobile.route.agent";
import { registerMobileCommonRoutes } from "./mobile.route.common";
import { registerMobileExpeditorRoutes } from "./mobile.route.expeditor";
import { registerMobilePublicRoutes } from "./mobile.route.public";
import { registerMobileSupervisorRoutes } from "./mobile.route.supervisor";

export async function registerMobileRoutes(app: FastifyInstance) {
  await registerMobilePublicRoutes(app);
  await registerMobileAgentRoutes(app);
  await registerMobileCommonRoutes(app);
  await registerMobileExpeditorRoutes(app);
  await registerMobileSupervisorRoutes(app);
}
