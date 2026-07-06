import type { FastifyInstance } from "fastify";
import { registerOrderApprovalRoutes } from "./orders.route.approval";
import { registerOrderBulkRoutes } from "./orders.route.bulk";
import { registerOrderCatalogRoutes } from "./orders.route.catalog";
import { registerOrderDetailRoutes } from "./orders.route.detail";
import { registerOrderListRoutes } from "./orders.route.list";
import { registerOrderPatchRoutes } from "./orders.route.patch";
import { registerOrderWriteRoutes } from "./orders.route.write";

export async function registerOrderRoutes(app: FastifyInstance) {
  await registerOrderListRoutes(app);
  await registerOrderCatalogRoutes(app);
  await registerOrderDetailRoutes(app);
  await registerOrderApprovalRoutes(app);
  await registerOrderPatchRoutes(app);
  await registerOrderBulkRoutes(app);
  await registerOrderWriteRoutes(app);
}
