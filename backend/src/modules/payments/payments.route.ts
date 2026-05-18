import type { FastifyInstance } from "fastify";
import { registerPaymentReadRoutes } from "./payments.route.read";
import { registerPaymentWriteRoutes } from "./payments.route.write";

export async function registerPaymentRoutes(app: FastifyInstance) {
  await registerPaymentReadRoutes(app);
  await registerPaymentWriteRoutes(app);
}
