import type { FastifyInstance } from "fastify";
import { registerProductBulkRoutes } from "./products.route.bulk";
import { registerProductImportRoutes } from "./products.route.import";
import { registerProductListRoutes } from "./products.route.list";
import { registerProductWriteRoutes } from "./products.route.write";

export async function registerProductRoutes(app: FastifyInstance) {
  await registerProductListRoutes(app);
  await registerProductWriteRoutes(app);
  await registerProductImportRoutes(app);
  await registerProductBulkRoutes(app);
}
