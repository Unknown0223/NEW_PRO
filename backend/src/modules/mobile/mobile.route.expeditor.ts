import type { FastifyInstance } from "fastify";
import { registerMobileExpeditorClientRoutes } from "./mobile.route.expeditor.clients";
import { registerMobileExpeditorDashboardRoutes } from "./mobile.route.expeditor.dashboard";
import { registerMobileExpeditorDeliveryRoutes } from "./mobile.route.expeditor.deliveries";
import { registerMobileExpeditorOrderRoutes } from "./mobile.route.expeditor.orders";
import { registerMobileExpeditorReturnRoutes } from "./mobile.route.expeditor.returns";
import { registerMobileExpeditorShipmentRoutes } from "./mobile.route.expeditor.shipments";

export async function registerMobileExpeditorRoutes(app: FastifyInstance) {
  await registerMobileExpeditorDeliveryRoutes(app);
  await registerMobileExpeditorOrderRoutes(app);
  await registerMobileExpeditorReturnRoutes(app);
  await registerMobileExpeditorDashboardRoutes(app);
  await registerMobileExpeditorClientRoutes(app);
  await registerMobileExpeditorShipmentRoutes(app);
}
