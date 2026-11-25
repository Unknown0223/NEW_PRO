import type { FastifyInstance } from "fastify";
import type { TasksReportFilters } from "../../contracts/reports.schemas";
import { tasksReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportTasksReportXlsx,
  getTasksReport,
  getTasksReportDataset,
  getTasksReportFilterOptions
} from "./tasks-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerTasksReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get("/api/:slug/reports/tasks/dataset", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<TasksReportFilters>(
      reply,
      request,
      tasksReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getTasksReportDataset(
      request.tenant!.id,
      { ...q, page: 1, limit: 5000 },
      { userId: actorUserIdOrNull(request), role: u.role }
    );
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/tasks/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getTasksReportFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/tasks/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportTasksReportXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="otchet-po-zadacham.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/tasks", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<TasksReportFilters>(
      reply,
      request,
      tasksReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getTasksReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
