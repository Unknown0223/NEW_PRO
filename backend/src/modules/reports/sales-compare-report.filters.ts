import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";

export async function getSalesCompareReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const [agents, categories] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "agent"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  return {
    group_by: [
      { id: "product", label: "По товарам" },
      { id: "agent", label: "По агентам" },
      { id: "client", label: "По клиентам" }
    ],
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    categories
  };
}