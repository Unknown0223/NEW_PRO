import type { FastifyInstance } from "fastify";
import { registerMobileClientQrRoutes } from "./mobile.route.client-qr";
import { registerMobilePaymentRoutes } from "./mobile.route.payments";
import { registerMobilePhotoRoutes } from "./mobile.route.photos";
import { registerMobileProfileRoutes } from "./mobile.route.profile";
import { registerMobileSyncRoutes } from "./mobile.route.sync";

export async function registerMobileCommonRoutes(app: FastifyInstance) {
  await registerMobileProfileRoutes(app);
  await registerMobileSyncRoutes(app);
  await registerMobilePhotoRoutes(app);
  await registerMobilePaymentRoutes(app);
  await registerMobileClientQrRoutes(app);
}
