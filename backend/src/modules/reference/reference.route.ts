import type { FastifyInstance } from "fastify";
import { registerReferenceCategoryRoutes } from "./reference.route.categories";
import { registerReferencePriceRoutes } from "./reference.route.price";
import { registerReferenceUserRoutes } from "./reference.route.users";
import { registerReferenceWarehouseRoutes } from "./reference.route.warehouses";

export async function registerReferenceRoutes(app: FastifyInstance) {
  await registerReferenceWarehouseRoutes(app);
  await registerReferenceUserRoutes(app);
  await registerReferenceCategoryRoutes(app);
  await registerReferencePriceRoutes(app);
}
