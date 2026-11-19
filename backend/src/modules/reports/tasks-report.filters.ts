import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";
import { prisma } from "../../config/database";
import { loadTaskTypes, TASK_PRIORITIES, TASK_STATUSES } from "../tasks/tasks.service";

const STATUS_LABEL_RU: Record<string, string> = {
  open: "Открыта",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена"
};

const PRIORITY_LABEL_RU: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий"
};

export async function getTasksReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const [assignees, creators, types, clients] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, ["agent", "expeditor", "supervisor"]),
      select: { id: true, name: true, code: true, role: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope),
      select: { id: true, name: true, code: true, role: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    loadTaskTypes(tenantId, false),
    prisma.$queryRaw<Array<{ id: number; name: string; code: string | null }>>`
      SELECT DISTINCT c.id, c.name, c.code
      FROM clients c
      INNER JOIN tenant_tasks t ON t.client_id = c.id AND t.tenant_id = c.tenant_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.name
      LIMIT 3000
    `
  ]);

  return {
    statuses: TASK_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL_RU[s] ?? s })),
    priorities: TASK_PRIORITIES.map((p) => ({ id: p, label: PRIORITY_LABEL_RU[p] ?? p })),
    assignees: assignees.map((u) => ({ id: u.id, name: u.name, code: u.code ?? "", role: u.role ?? "" })),
    creators: creators.map((u) => ({ id: u.id, name: u.name, code: u.code ?? "", role: u.role ?? "" })),
    clients: clients.map((c) => ({ id: c.id, name: c.name, code: c.code ?? "" })),
    task_types: types.map((t) => ({ id: t.id, name: t.name, code: t.code ?? "" }))
  };
}

export { STATUS_LABEL_RU, PRIORITY_LABEL_RU };
