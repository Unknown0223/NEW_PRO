import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ReportsReceivablesListQuery } from "../../contracts/reports.schemas";
import { reportsReceivablesListQuerySchema } from "../../contracts/reports.schemas";
import { exportOrderDebtsXlsx, listOrderDebtsReport } from "./order-debts-report.service";
import { exportClientReceivablesXlsx, getClientReceivables } from "./reports.service";
import { ensureTenantContext } from "../../lib/tenant-context";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function registerReportsDebtsRoutes(app: FastifyInstance, guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;

  // Qarzdorlik / ochiq zakazlar (kredit yuki) — export avvalo (statik suffiks)
  const receivablesExportHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsReceivablesListQuery>(
      reply,
      request,
      reportsReceivablesListQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const { buffer, truncated, total } = await exportClientReceivablesXlsx(request.tenant!.id, {
      search: q.search,
      only_over_limit: q.only_over_limit,
      active_only: q.active_only
    });
    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .header("Content-Disposition", 'attachment; filename="qarzdorlik.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  };

  const receivablesListHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsReceivablesListQuery>(
      reply,
      request,
      reportsReceivablesListQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getClientReceivables(request.tenant!.id, q);
    return reply.send(data);
  };

  app.get("/api/:slug/reports/receivables/export", { preHandler: reportExportPreHandler }, receivablesExportHandler);
  app.get("/api/:slug/reports/receivables", { preHandler: reportViewPreHandler }, receivablesListHandler);
  app.get("/api/:slug/reports/client-receivables/export", { preHandler: reportExportPreHandler }, receivablesExportHandler);
  app.get("/api/:slug/reports/client-receivables", { preHandler: reportViewPreHandler }, receivablesListHandler);

  app.get("/api/:slug/reports/order-debts/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const { buffer, truncated, total } = await exportOrderDebtsXlsx(request.tenant!.id, q);
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="dolgi-po-zakazam.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/order-debts", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await listOrderDebtsReport(request.tenant!.id, q);
    return reply.send(data);
  });
}
