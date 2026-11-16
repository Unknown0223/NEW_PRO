import type { FastifyInstance } from "fastify";
import type { P1ReportFilters } from "../../contracts/reports.schemas";
import { p1ReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { exportP1ReportXlsx, getP1FilterOptions, getP1Report } from "./p1-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerP1ReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get("/api/:slug/reports/p1/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getP1FilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/p1/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportP1ReportXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="p1-otchet.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/p1", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<P1ReportFilters>(
      reply,
      request,
      p1ReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getP1Report(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
