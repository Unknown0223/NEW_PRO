import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";

export async function getDiscountDetailReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const agents = await prisma.user.findMany({
    where: staffWhereForFilterOptions(tenantId, scope, "agent"),
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });
  return {
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" }))
  };
}