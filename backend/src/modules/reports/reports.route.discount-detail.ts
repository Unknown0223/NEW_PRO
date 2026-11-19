import type { FastifyInstance } from "fastify";
import type { DiscountDetailReportFilters } from "../../contracts/reports.schemas";
import { discountDetailReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportDiscountDetailReportXlsx,
  getDiscountDetailReport,
  getDiscountDetailReportFilterOptions
} from "./discount-detail-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerDiscountDetailReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/discount-detail/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getDiscountDetailReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/discount-detail/export",
    { preHandler: reportExportPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const u = getAccessUser(request);
      const { buffer, total, truncated } = await exportDiscountDetailReportXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="detalnyy-skidki.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    }
  );

  app.get("/api/:slug/reports/discount-detail", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<DiscountDetailReportFilters>(
      reply,
      request,
      discountDetailReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getDiscountDetailReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}