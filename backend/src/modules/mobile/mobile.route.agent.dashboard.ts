import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getMobileAgentDailySales, getMobileAgentDashboard } from "./mobile.service";
import { getMobileAgentTimesheet } from "./mobile-agent-timesheet.service";
import { getMobileAgentKpi } from "./mobile-agent-kpi.service";
import { workRegionTodayKey } from "./mobile-agent-sync.config.service";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";

export async function registerMobileAgentDashboardRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-dashboard — agent KPI (bugun)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-dashboard",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileAgentDashboard(request.tenant!.id, userId);
      return reply.send(data);
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-daily-sales — oylik savdo (fact: buyurtma − vozvrat s polki)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-daily-sales",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileAgentDailySales(request.tenant!.id, userId);
      return reply.send(data);
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-timesheet?month=YYYY-MM — agent oylik табель (self)
  // Web `timesheet` moduli bilan bitta manba; agent faqat o'zini ko'radi.
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-timesheet",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const q = request.query as Record<string, string | undefined>;
      const month = (q.month ?? "").trim() || workRegionTodayKey().slice(0, 7);
      try {
        const data = await getMobileAgentTimesheet(request.tenant!.id, userId, month);
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_MONTH") return sendApiError(reply, request, 400, "BadMonth");
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-kpi?month=YYYY-MM — agent KPI (plan/fact)
  // Web «Установка планов» + timesheet; bonus/weight webda yo‘q — invent qilinmaydi.
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-kpi",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const q = request.query as Record<string, string | undefined>;
      const month = (q.month ?? "").trim() || undefined;
      try {
        const data = await getMobileAgentKpi(request.tenant!.id, userId, month);
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_MONTH") return sendApiError(reply, request, 400, "BadMonth");
        throw e;
      }
    }
  );
}
