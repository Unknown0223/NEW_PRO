import type { FastifyInstance } from "fastify";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportGpsDeliveryRoutesXlsx,
  getGpsDeliveryRoutesFilterOptions,
  getGpsDeliveryRoutesReport,
  parseGpsDeliveryRoutesQuery
} from "./gps-delivery-routes-report.service";
import { createReportRouteGuards, reportQueryRaw } from "./reports.route.shared";

export function registerGpsDeliveryRoutesReports(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards>
): void {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get("/api/:slug/reports/gps-delivery-routes/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getGpsDeliveryRoutesFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/gps-delivery-routes/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportGpsDeliveryRoutesXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header(
        "Content-Disposition",
        'attachment; filename="otchet-po-marshrutam-dostavshchikov.xlsx"'
      )
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/gps-delivery-routes", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseGpsDeliveryRoutesQuery(reportQueryRaw(request));
    const u = getAccessUser(request);
    const data = await getGpsDeliveryRoutesReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
