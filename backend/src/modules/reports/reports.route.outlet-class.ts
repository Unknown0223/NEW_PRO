import type { FastifyInstance } from "fastify";
import type { OutletClassReportFilters } from "../../contracts/reports.schemas";
import { outletClassReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportOutletClassReportXlsx,
  getOutletClassReport,
  getOutletClassReportFilterOptions
} from "./outlet-class-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerOutletClassReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/outlet-class/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getOutletClassReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get("/api/:slug/reports/outlet-class/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportOutletClassReportXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="klassifikatsiya-tt.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/outlet-class", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<OutletClassReportFilters>(
      reply,
      request,
      outletClassReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getOutletClassReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
