import type { FastifyInstance } from "fastify";
import { registerMobilePaymentRoutes } from "./mobile.route.payments";
import { registerMobilePhotoRoutes } from "./mobile.route.photos";
import { registerMobileProfileRoutes } from "./mobile.route.profile";
import { registerMobileStockSnapshotRoutes } from "./mobile.route.stock-snapshot";
import { registerMobileSyncRoutes } from "./mobile.route.sync";

export async function registerMobileCommonRoutes(app: FastifyInstance) {
  await registerMobileProfileRoutes(app);
  await registerMobileSyncRoutes(app);
  await registerMobilePhotoRoutes(app);
  await registerMobilePaymentRoutes(app);
  await registerMobileStockSnapshotRoutes(app);
}
