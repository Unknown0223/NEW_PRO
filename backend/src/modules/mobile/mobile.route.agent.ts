import type { FastifyInstance } from "fastify";
import { registerMobileAgentClientRoutes } from "./mobile.route.agent.clients";
import { registerMobileAgentConfigRoutes } from "./mobile.route.agent.config";
import { registerMobileAgentDashboardRoutes } from "./mobile.route.agent.dashboard";
import { registerMobileAgentOrderRoutes } from "./mobile.route.agent.orders";
import { registerMobileAgentOrderSyncRoutes } from "./mobile.route.agent.orders.sync";

export async function registerMobileAgentRoutes(app: FastifyInstance) {
  await registerMobileAgentConfigRoutes(app);
  await registerMobileAgentOrderRoutes(app);
  await registerMobileAgentOrderSyncRoutes(app);
  await registerMobileAgentDashboardRoutes(app);
  await registerMobileAgentClientRoutes(app);
}
