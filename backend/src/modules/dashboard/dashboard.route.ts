import type { FastifyInstance } from "fastify";
import { registerDashboardCoreRoutes } from "./dashboard.routes.core";
import { registerDashboardFinanceRoutes } from "./dashboard.routes.finance";
import { registerDashboardSalesMonitoringRoutes } from "./dashboard.routes.sales-monitoring";
import { registerDashboardSalesRoutes } from "./dashboard.routes.sales";
import { registerDashboardSupervisorRoutes } from "./dashboard.routes.supervisor";

export async function registerDashboardRoutes(app: FastifyInstance) {
  registerDashboardCoreRoutes(app);
  registerDashboardSupervisorRoutes(app);
  registerDashboardFinanceRoutes(app);
  registerDashboardSalesRoutes(app);
  registerDashboardSalesMonitoringRoutes(app);
}
