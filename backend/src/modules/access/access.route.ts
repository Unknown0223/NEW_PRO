import type { FastifyInstance } from "fastify";
import { registerAccessCatalogRoutes } from "./access.route.catalog";
import { registerAccessDimensionsRoutes } from "./access.route.dimensions";
import { registerAccessDimensionsUsersRoutes } from "./access.route.dimensions-users";
import { registerAccessRouteMe } from "./access.route.me";
import { registerAccessRolesHistoryRoutes } from "./access.route.roles-history";
import { registerAccessUsersBulkRoutes } from "./access.route.users-bulk";
import { registerAccessUsersListRoutes } from "./access.route.users-list";
import { registerAccessUsersWriteRoutes } from "./access.route.users-write";

export async function registerAccessRoutes(app: FastifyInstance) {
  await registerAccessRouteMe(app);
  await registerAccessDimensionsRoutes(app);
  await registerAccessDimensionsUsersRoutes(app);
  await registerAccessCatalogRoutes(app);
  await registerAccessUsersListRoutes(app);
  await registerAccessUsersBulkRoutes(app);
  await registerAccessUsersWriteRoutes(app);
  await registerAccessRolesHistoryRoutes(app);
}
