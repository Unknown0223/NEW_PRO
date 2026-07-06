import type { Job } from "bullmq";
import { prisma } from "../config/database";
import { BACKGROUND_QUEUE_NAME } from "../jobs/constants";
import { logger } from "../config/logger";

type JobLogStatus = "completed" | "failed";

function extractTenantId(job: Job): number | null {
  const data = job.data as { tenant_id?: number } | undefined;
  if (data?.tenant_id != null && Number.isFinite(data.tenant_id)) {
    return data.tenant_id;
  }
  return null;
}

export async function logJobResult(
  job: Job,
  status: JobLogStatus,
  startedAt: Date,
  result?: unknown,
  errorMessage?: string
): Promise<void> {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  try {
    await prisma.jobLog.create({
      data: {
        tenant_id: extractTenantId(job),
        queue_name: BACKGROUND_QUEUE_NAME,
        job_id: String(job.id ?? job.name),
        job_name: job.name,
        status,
        result: result != null ? (result as object) : undefined,
        error: errorMessage?.slice(0, 4000) ?? null,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs
      }
    });
  } catch (err) {
    logger.warn({ err, jobId: job.id, jobName: job.name }, "job_log_write_failed");
  }
}
