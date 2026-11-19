import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import { TASK_PRIORITIES, TASK_STATUSES } from "../tasks/tasks.service";
import type { TasksReportFilters } from "./tasks-report.types";

const STATUS_SET = new Set<string>(TASK_STATUSES);
const PRIORITY_SET = new Set<string>(TASK_PRIORITIES);

export function parseTasksReportQuery(q: Record<string, string | undefined>): TasksReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    statuses: strList(q.statuses).filter((s) => STATUS_SET.has(s)),
    priorities: strList(q.priorities).filter((s) => PRIORITY_SET.has(s)),
    assignee_ids: intList(q.assignee_ids),
    created_by_ids: intList(q.created_by_ids),
    client_ids: intList(q.client_ids),
    task_type_refs: strList(q.task_type_refs),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
