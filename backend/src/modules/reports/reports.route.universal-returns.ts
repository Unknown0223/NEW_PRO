import type { FastifyInstance } from "fastify";
import type { UniversalReturnsReportFilters } from "../../contracts/reports.schemas";
import { universalReturnsReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportUniversalReturnsReportXlsx,
  getUniversalReturnsReport,
  getUniversalReturnsReportFilterOptions
} from "./universal-returns-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerUniversalReturnsReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/universal-returns/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getUniversalReturnsReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/universal-returns/export",
    { preHandler: reportExportPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const u = getAccessUser(request);
      const { buffer, total, truncated } = await exportUniversalReturnsReportXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="universalnyy-vozvrat.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    }
  );

  app.get("/api/:slug/reports/universal-returns", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<UniversalReturnsReportFilters>(
      reply,
      request,
      universalReturnsReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getUniversalReturnsReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
