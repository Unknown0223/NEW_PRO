import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { BACKGROUND_QUEUE_NAME } from "../jobs/constants";
import { processBackgroundJob } from "../jobs/process-background-job";
import { logJobResult } from "../lib/job-log.service";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

/**
 * Fon ishlar: `ping`, `order_status_notify`, importlar (`import_clients_xlsx`, `import_stock_xlsx`, `import_products_*`), …
 */
const worker = new Worker(
  BACKGROUND_QUEUE_NAME,
  async (job) => {
    const startedAt = new Date();
    try {
      const result = await processBackgroundJob(job);
      await logJobResult(job, "completed", startedAt, result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logJobResult(job, "failed", startedAt, undefined, message);
      throw err;
    }
  },
  {
    connection,
    lockDuration: 10 * 60 * 1000,
    stalledInterval: 30 * 1000,
    maxStalledCount: 5
  }
);

worker.on("completed", (job) => {
  process.stdout.write(`[worker] job ${job.id} (${job.name}) bajarildi\n`);
});

worker.on("failed", (job, err) => {
  process.stderr.write(`[worker] job ${job?.id} xato: ${err.message}\n`);
});

const safeRedisUrl = env.REDIS_URL.includes("@")
  ? env.REDIS_URL.replace(/\/\/[^@]+\//, "//***@/")
  : env.REDIS_URL;
process.stdout.write(
  `[worker] BullMQ tinglayapti: queue=${BACKGROUND_QUEUE_NAME} redis=${safeRedisUrl}\n`
);

function shutdown(signal: string): void {
  process.stdout.write(`[worker] ${signal}, yopilmoqda...\n`);
  void worker
    .close()
    .then(() => connection.quit())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
