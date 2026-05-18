import { env } from "../config/env";

export function isDashboardPerfLogEnabled(): boolean {
  return env.DASHBOARD_PERF_LOG === "1";
}

export type DashboardPerfMeta = {
  route: string;
  tenantId: number;
  durationMs: number;
  supervisorRole?: boolean;
};

/** Structured log + optional response header for dashboard endpoints. */
export function recordDashboardPerf(
  log: { info: (o: Record<string, unknown>) => void },
  reply: { header: (k: string, v: string) => void },
  meta: DashboardPerfMeta
): void {
  if (isDashboardPerfLogEnabled()) {
    log.info({
      msg: "dashboard.request",
      ...meta
    });
    reply.header("X-Dashboard-Duration-Ms", String(Math.round(meta.durationMs)));
  }
}
