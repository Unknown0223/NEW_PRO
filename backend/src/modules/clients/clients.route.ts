import type { FastifyInstance } from "fastify";
import { registerClientAssetsRoutes } from "./clients.route.assets";
import { registerClientBalanceRoutes } from "./clients.route.balance";
import { registerClientDedupeRoutes } from "./clients.route.dedupe";
import { registerClientDetailRoutes } from "./clients.route.detail";
import { registerClientImportRoutes } from "./clients.route.import";
import { registerClientListRoutes } from "./clients.route.list";
import { registerClientWriteRoutes } from "./clients.route.write";

export async function registerClientRoutes(app: FastifyInstance) {
  await registerClientListRoutes(app);
  await registerClientImportRoutes(app);
  await registerClientDedupeRoutes(app);
  await registerClientWriteRoutes(app);
  await registerClientDetailRoutes(app);
  await registerClientAssetsRoutes(app);
  await registerClientBalanceRoutes(app);
}
