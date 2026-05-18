import type { FastifyInstance } from "fastify";
import { createReportRouteGuards } from "./reports.route.shared";
import { registerReportsAnalyticsRoutes } from "./reports.route.analytics";
import { registerReportsBuilderRoutes } from "./reports.route.builder";
import { registerReportsDebtsRoutes } from "./reports.route.debts";
import { registerReportsFinancialRoutes } from "./reports.route.financial";
import { registerReportsSpecializedRoutes } from "./reports.route.specialized";

export async function registerReportRoutes(app: FastifyInstance) {
  const guards = createReportRouteGuards();
  await registerReportsAnalyticsRoutes(app, guards);
  await registerReportsDebtsRoutes(app, guards);
  await registerReportsFinancialRoutes(app, guards);
  await registerReportsSpecializedRoutes(app, guards);
  await registerReportsBuilderRoutes(app, guards);
}
