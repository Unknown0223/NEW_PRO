import type { FastifyInstance } from "fastify";
import { registerWorkSlotListRoutes } from "./work-slots.route.read";
import { registerWorkSlotDetailRoutes } from "./work-slots.route.write";

export async function registerWorkSlotRoutes(app: FastifyInstance) {
  await registerWorkSlotListRoutes(app);
  await registerWorkSlotDetailRoutes(app);
}
