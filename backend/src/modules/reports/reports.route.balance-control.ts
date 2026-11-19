import type { FastifyInstance } from "fastify";
import type { BalanceControlReportFilters } from "../../contracts/reports.schemas";
import { balanceControlReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportBalanceControlReportXlsx,
  getBalanceControlReport,
  getBalanceControlReportFilterOptions
} from "./balance-control-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerBalanceControlReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/balance-control/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getBalanceControlReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/balance-control/export",
    { preHandler: reportExportPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const u = getAccessUser(request);
      const { buffer, total, truncated } = await exportBalanceControlReportXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="kontrol-balansov.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    }
  );

  app.get("/api/:slug/reports/balance-control", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<BalanceControlReportFilters>(
      reply,
      request,
      balanceControlReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getBalanceControlReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}