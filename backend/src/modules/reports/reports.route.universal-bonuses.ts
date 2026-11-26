import type { FastifyInstance } from "fastify";
import type { UniversalBonusesReportFilters } from "../../contracts/reports.schemas";
import { universalBonusesReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportUniversalBonusesReportXlsx,
  getUniversalBonusesReport,
  getUniversalBonusesReportDataset,
  getUniversalBonusesReportFilterOptions
} from "./universal-bonuses-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerUniversalBonusesReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get(
    "/api/:slug/reports/universal-bonuses/dataset",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseReportQueryOr400<UniversalBonusesReportFilters>(
        reply,
        request,
        universalBonusesReportQuerySchema,
        reportQueryRaw(request)
      );
      if (!q) return;
      const u = getAccessUser(request);
      const data = await getUniversalBonusesReportDataset(
        request.tenant!.id,
        { ...q, page: 1, limit: 5000 },
        { userId: actorUserIdOrNull(request), role: u.role }
      );
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/universal-bonuses/filter-options",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getUniversalBonusesReportFilterOptions(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/reports/universal-bonuses/export",
    { preHandler: reportExportPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const u = getAccessUser(request);
      const { buffer, total, truncated } = await exportUniversalBonusesReportXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="universalnyy-bonus.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    }
  );

  app.get("/api/:slug/reports/universal-bonuses", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<UniversalBonusesReportFilters>(
      reply,
      request,
      universalBonusesReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getUniversalBonusesReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });
}