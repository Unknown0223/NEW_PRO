import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";

export async function getExpeditorShareReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const expeditors = await prisma.user.findMany({
    where: staffWhereForFilterOptions(tenantId, scope, "expeditor"),
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
    take: 3000
  });
  return {
    expeditors: expeditors.map((e) => ({ id: e.id, name: e.name, code: e.code ?? "" }))
  };
}