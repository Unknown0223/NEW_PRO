import type { FastifyInstance } from "fastify";
import { registerStaffAgentRoutes } from "./staff.route.agents";
import { registerStaffAuditorRoutes } from "./staff.route.auditors";
import { registerStaffCollectorRoutes } from "./staff.route.collectors";
import { registerStaffExpeditorRoutes } from "./staff.route.expeditors";
import { registerStaffOperatorRoutes } from "./staff.route.operators";
import { registerStaffSkladchikRoutes } from "./staff.route.skladchik";
import { registerStaffSupervisorRoutes } from "./staff.route.supervisors";

export async function registerStaffRoutes(app: FastifyInstance) {
  await registerStaffAgentRoutes(app);
  await registerStaffSupervisorRoutes(app);
  await registerStaffCollectorRoutes(app);
  await registerStaffAuditorRoutes(app);
  await registerStaffExpeditorRoutes(app);
  await registerStaffOperatorRoutes(app);
  await registerStaffSkladchikRoutes(app);
}
