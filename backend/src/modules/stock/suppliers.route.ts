import type { FastifyInstance } from "fastify";
import { registerSupplierCrudRoutes } from "./suppliers.route.read";
import { registerSupplierPaymentRoutes } from "./suppliers.route.write";

export async function registerSupplierRoutes(app: FastifyInstance) {
  await registerSupplierCrudRoutes(app);
  await registerSupplierPaymentRoutes(app);
}
