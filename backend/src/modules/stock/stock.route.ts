import type { FastifyInstance } from "fastify";
import { registerStockAnalyticsRoutes } from "./stock.route.analytics";
import { registerStockBalancesRoutes } from "./stock.route.balances";
import { registerStockCoreRoutes } from "./stock.route.core";
import { registerStockCorrectionRoutes } from "./stock.route.corrections";
import { registerStockImportRoutes } from "./stock.route.import";
import { registerStockMaterialReportRoutes } from "./stock.route.material-report";
import { registerStockReceiptsReportRoutes } from "./stock.route.receipts-report";

export async function registerStockRoutes(app: FastifyInstance) {
  await registerStockImportRoutes(app);
  await registerStockReceiptsReportRoutes(app);
  await registerStockMaterialReportRoutes(app);
  await registerStockAnalyticsRoutes(app);
  await registerStockBalancesRoutes(app);
  await registerStockCoreRoutes(app);
  await registerStockCorrectionRoutes(app);
}
