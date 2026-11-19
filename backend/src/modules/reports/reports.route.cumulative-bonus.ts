import type { FastifyInstance } from "fastify";
import type { CumulativeBonusFilters } from "../../contracts/reports.schemas";
import { cumulativeBonusQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportCumulativeBonusXlsx,
  getCumulativeBonusFilterOptions,
  getCumulativeBonusReport
} from "./cumulative-bonus.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerCumulativeBonusReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/cumulative-bonus/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getCumulativeBonusFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get("/api/:slug/reports/cumulative-bonus/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportCumulativeBonusXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="nakopitelnyy-bonus.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/cumulative-bonus", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<CumulativeBonusFilters>(
      reply,
      request,
      cumulativeBonusQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getCumulativeBonusReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}
