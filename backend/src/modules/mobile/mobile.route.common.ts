import type { FastifyInstance } from "fastify";
import { registerMobileFaceRoutes } from "./mobile.route.face";
import { registerMobilePaymentRoutes } from "./mobile.route.payments";
import { registerMobilePhotoRoutes } from "./mobile.route.photos";
import { registerMobileProfileRoutes } from "./mobile.route.profile";
import { registerMobileStockSnapshotRoutes } from "./mobile.route.stock-snapshot";
import { registerMobileSyncRoutes } from "./mobile.route.sync";
import { registerMobileTaskRoutes } from "./mobile.route.tasks";

export async function registerMobileCommonRoutes(app: FastifyInstance) {
  await registerMobileProfileRoutes(app);
  await registerMobileFaceRoutes(app);
  await registerMobileSyncRoutes(app);
  await registerMobilePhotoRoutes(app);
  await registerMobilePaymentRoutes(app);
  await registerMobileStockSnapshotRoutes(app);
  await registerMobileTaskRoutes(app);
}
