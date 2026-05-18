import type { FastifyInstance } from "fastify";
import { registerSalesReturnReadRoutes } from "./sales-returns.route.read";
import { registerSalesReturnWriteRoutes } from "./sales-returns.route.write";

export async function registerSalesReturnRoutes(app: FastifyInstance) {
  await registerSalesReturnReadRoutes(app);
  await registerSalesReturnWriteRoutes(app);
}
