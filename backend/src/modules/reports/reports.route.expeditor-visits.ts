import type { FastifyInstance } from "fastify";
import type { ExpeditorVisitsReportFilters } from "../../contracts/reports.schemas";
import { expeditorVisitsReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportExpeditorVisitsReportXlsx,
  getExpeditorVisitsReport,
  getExpeditorVisitsReportFilterOptions
} from "./expeditor-visits-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerExpeditorVisitsReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/expeditor-visits/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getExpeditorVisitsReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/expeditor-visits/export",
    { preHandler: reportExportPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const u = getAccessUser(request);
      const { buffer, total, truncated } = await exportExpeditorVisitsReportXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="vizity-ekspedirov.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    }
  );

  app.get("/api/:slug/reports/expeditor-visits", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ExpeditorVisitsReportFilters>(
      reply,
      request,
      expeditorVisitsReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getExpeditorVisitsReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
