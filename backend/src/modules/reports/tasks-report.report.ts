import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { loadTaskTypes } from "../tasks/tasks.service";
import { PRIORITY_LABEL_RU, STATUS_LABEL_RU } from "./tasks-report.filters";
import type { TasksReportFilters, TasksReportRow } from "./tasks-report.types";

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

function buildWhere(tenantId: number, f: TasksReportFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`t.tenant_id = ${tenantId}`];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  if (from) parts.push(Prisma.sql`t.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`t.created_at <= ${to}`);
  if (f.statuses.length) parts.push(Prisma.sql`t.status IN (${sqlInStrings(f.statuses)})`);
  if (f.priorities.length) parts.push(Prisma.sql`t.priority IN (${sqlInStrings(f.priorities)})`);
  if (f.assignee_ids.length) {
    parts.push(Prisma.sql`t.assignee_user_id IN (${Prisma.join(f.assignee_ids)})`);
  }
  if (f.created_by_ids.length) {
    parts.push(Prisma.sql`t.created_by_user_id IN (${Prisma.join(f.created_by_ids)})`);
  }
  if (f.client_ids.length) {
    parts.push(Prisma.sql`t.client_id IN (${Prisma.join(f.client_ids)})`);
  }
  if (f.task_type_refs.length) {
    parts.push(Prisma.sql`COALESCE(t.task_type_ref, '') IN (${sqlInStrings(f.task_type_refs)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(
        t.title ILIKE ${pat}
        OR COALESCE(t.description, '') ILIKE ${pat}
        OR COALESCE(c.name, '') ILIKE ${pat}
        OR COALESCE(asg.name, '') ILIKE ${pat}
        OR COALESCE(cr.name, '') ILIKE ${pat}
      )`
    );
  }
  if (actor) {
    parts.push(
      Prisma.sql`(
        ${buildScopedAgentExistsSql(tenantId, Prisma.sql`t.assignee_user_id`, actor)}
        OR ${buildScopedAgentExistsSql(tenantId, Prisma.sql`t.created_by_user_id`, actor)}
      )`
    );
  }
  return Prisma.join(parts, " AND ");
}

export async function getTasksReport(tenantId: number, f: TasksReportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;
  const types = await loadTaskTypes(tenantId, true);
  const typeName = new Map<string, string>();
  for (const t of types) {
    typeName.set(t.id, t.name);
    if (t.code) typeName.set(t.code, t.name);
  }

  type Raw = {
    task_id: number;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    task_type_ref: string | null;
    assignee_name: string | null;
    created_by_name: string | null;
    client_name: string | null;
    created_at: Date;
    due_at: Date | null;
    completed_at: Date | null;
    result_comment: string | null;
    photo_count: number;
    total_count: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    SELECT
      t.id AS task_id,
      t.title,
      COALESCE(t.description, '') AS description,
      t.status,
      t.priority,
      t.task_type_ref,
      COALESCE(asg.name, '') AS assignee_name,
      COALESCE(cr.name, '') AS created_by_name,
      COALESCE(c.name, '') AS client_name,
      t.created_at,
      t.due_at,
      t.completed_at,
      COALESCE(t.result_comment, '') AS result_comment,
      CASE
        WHEN jsonb_typeof(t.result_photos) = 'array' THEN COALESCE(jsonb_array_length(t.result_photos), 0)
        ELSE 0
      END::int AS photo_count,
      COUNT(*) OVER()::bigint AS total_count
    FROM tenant_tasks t
    LEFT JOIN users asg ON asg.id = t.assignee_user_id AND asg.tenant_id = t.tenant_id
    LEFT JOIN users cr ON cr.id = t.created_by_user_id AND cr.tenant_id = t.tenant_id
    LEFT JOIN clients c ON c.id = t.client_id AND c.tenant_id = t.tenant_id
    WHERE ${whereSql}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: TasksReportRow[] = rows.map((r, idx) => {
    const ref = (r.task_type_ref ?? "").trim();
    return {
      row_number: offset + idx + 1,
      task_id: r.task_id,
      title: r.title,
      description: r.description ?? "",
      status: r.status,
      status_label: STATUS_LABEL_RU[r.status] ?? r.status,
      priority: r.priority,
      priority_label: PRIORITY_LABEL_RU[r.priority] ?? r.priority,
      task_type: (ref && typeName.get(ref)) || ref || "—",
      assignee_name: r.assignee_name ?? "",
      created_by_name: r.created_by_name ?? "",
      client_name: r.client_name ?? "",
      created_at: r.created_at.toISOString(),
      due_at: r.due_at ? r.due_at.toISOString() : null,
      completed_at: r.completed_at ? r.completed_at.toISOString() : null,
      result_comment: r.result_comment ?? "",
      photo_count: Number(r.photo_count ?? 0)
    };
  });

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    rows: mapped
  };
}
