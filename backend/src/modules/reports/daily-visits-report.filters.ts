import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";

export async function getDailyVisitsReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const agents = await prisma.user.findMany({
    where: staffWhereForFilterOptions(tenantId, scope, "agent"),
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
    take: 3000
  });
  const now = new Date();
  const years: number[] = [];
  for (let y = now.getUTCFullYear(); y >= now.getUTCFullYear() - 5; y--) years.push(y);
  return {
    visit_kinds: [
      { id: "planned", label: "Запланированные визиты" },
      { id: "unplanned", label: "Внеплановые визиты" }
    ],
    months: Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      label: String(i + 1)
    })),
    years: years.map((y) => ({ id: String(y), label: String(y) })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" }))
  };
}
