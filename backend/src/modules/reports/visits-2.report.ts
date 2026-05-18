import type { ReportActor } from "./client-sales-4-report.service";
import type { Visits2Filters, Visits2ReportPayload } from "./visits-2.types";
import { runVisits2Core } from "./visits-2.core";

export async function getVisits2Report(
  tenantId: number,
  f: Visits2Filters,
  actor?: ReportActor
): Promise<Visits2ReportPayload> {
  const offset = (f.page - 1) * f.limit;
  const { rows, total } = await runVisits2Core(tenantId, f, actor, { offset, limit: f.limit });
  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total,
    rows
  };
}

