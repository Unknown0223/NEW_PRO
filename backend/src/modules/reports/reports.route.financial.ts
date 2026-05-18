import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentOrdersFilters, IncomeReportQuery, ReportsCashFlowQuery } from "../../contracts/reports.schemas";
import {
  agentOrdersQuerySchema,
  incomeReportQuerySchema,
  reportsCashFlowQuerySchema
} from "../../contracts/reports.schemas";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getAgentOrdersFilterOptions, getAgentOrdersReport } from "./agent-orders-report.service";
import { getCashFlowReport, resolveCashDeskIdForReport } from "./cash-flow-report.service";
import {
  exportIncomeReportXlsx,
  getIncomeReport,
  getIncomeReportFilterOptions
} from "./income-report.service";
import { ensureTenantContext } from "../../lib/tenant-context";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function registerReportsFinancialRoutes(app: FastifyInstance, guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;

  /** Движение денежных средств (касса + период, Terminal / Naqd) */
  app.get("/api/:slug/reports/cash-flow", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsCashFlowQuery>(
      reply,
      request,
      reportsCashFlowQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    try {
      const cashDeskId = await resolveCashDeskIdForReport(request.tenant!.id, q.cash_desk_id_raw);
      const data = await getCashFlowReport(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        cash_desk_id: cashDeskId
      });
      return reply.send(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ERR";
      if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 404, "BAD_CASH_DESK");
      if (msg === "BAD_RANGE" || msg.startsWith("BAD_DATE")) {
        return sendApiError(reply, request, 400, msg);
      }
      throw e;
    }
  });

  app.get("/api/:slug/reports/income-report/filter-options", { preHandler: incomeViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getIncomeReportFilterOptions(request.tenant!.id);
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/income-report", { preHandler: incomeViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<IncomeReportQuery>(
      reply,
      request,
      incomeReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const userId = actorUserIdOrNull(request);
    const data = await getIncomeReport(request.tenant!.id, q, {
      userId,
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/income-report/export/:kind", { preHandler: incomeExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { kind } = request.params as { kind: "period" | "territory" | "clients" | "agents" };
    if (!["period", "territory", "clients", "agents"].includes(kind)) {
      return sendApiError(reply, request, 400, "BAD_KIND");
    }
    const q = parseReportQueryOr400<IncomeReportQuery>(
      reply,
      request,
      incomeReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const userId = actorUserIdOrNull(request);
    const { buffer } = await exportIncomeReportXlsx(
      request.tenant!.id,
      q,
      { userId, role: u.role },
      kind
    );
    const names: Record<string, string> = {
      period: "Отчёт по поступлениям (Поступления за период).xlsx",
      territory: "Отчёт по поступлениям (По территории).xlsx",
      clients: "Отчёт по поступлениям (Поступления по клиентам).xlsx",
      agents: "Отчёт по поступлениям (По агентам).xlsx"
    };
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${names[kind]}"`)
      .send(buffer);
  });

  app.get("/api/:slug/reports/agent-orders/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getAgentOrdersFilterOptions(request.tenant!.id);
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/agent-orders", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<AgentOrdersFilters>(
      reply,
      request,
      agentOrdersQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getAgentOrdersReport(request.tenant!.id, q);
    return reply.send({ data });
  });

}
