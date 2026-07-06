/** `env` avval yuklansin — `app` → Prisma `DATABASE_URL` ni `process.env` dan oladi. */
import { env } from "./config/env";
import { buildApp } from "./app";
import { prisma } from "./config/database";
import { logger } from "./config/logger";
import { closeOrderEventBusRedis, initOrderEventBusRedis } from "./lib/order-event-bus";
import { disableAutoClose, enableAutoClose } from "./lib/order-auto-cron";
import { disableDashboardCacheWarm, enableDashboardCacheWarm } from "./lib/dashboard-cache-warm";
import {
  disableProductPriceScheduleCron,
  enableProductPriceScheduleCron
} from "./lib/product-price-schedule-cron";
import {
  disablePaymentReturnFinalizeCron,
  enablePaymentReturnFinalizeCron
} from "./lib/payment-return-finalize-cron";
import {
  disableConsignmentClosureCron,
  enableConsignmentClosureCron
} from "./lib/consignment-closure-cron";
import { disableActivityRetentionCron, enableActivityRetentionCron } from "./lib/activity-retention-cron";

async function main() {
  await prisma.$connect();
  const app = buildApp();
  await initOrderEventBusRedis(app.log);

  /** Dev/test: `0.0.0.0` ba’zi Windows portlarida EACCES beradi; lokalda 127.0.0.1 yetarli. */
  const listenHost = env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
  await app.listen({ port: env.PORT, host: listenHost });
  app.log.info({ port: env.PORT, host: listenHost }, "Server listening");

  enableAutoClose();
  app.log.info("Auto-status cron worker enabled.");
  enableProductPriceScheduleCron();
  app.log.info("Product price schedule cron enabled.");
  enablePaymentReturnFinalizeCron();
  app.log.info("Payment return finalize cron enabled.");
  enableDashboardCacheWarm();
  enableActivityRetentionCron();
  app.log.info("Activity retention cron enabled.");
  enableConsignmentClosureCron();
  app.log.info("Consignment month closure cron enabled.");

  const shutdown = async () => {
    disableAutoClose();
    disableProductPriceScheduleCron();
    disablePaymentReturnFinalizeCron();
    disableDashboardCacheWarm();
    disableActivityRetentionCron();
    disableConsignmentClosureCron();
    await app.close();
    await closeOrderEventBusRedis();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error({ err: error }, "Fatal startup error");
  process.exit(1);
});
