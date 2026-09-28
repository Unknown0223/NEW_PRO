import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { clientUniqueHttp } from "../clients/clients.write.uniques";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import {
  mobileCreateSupervisorClientBodySchema,
  mobilePatchClientBodySchema
} from "../../contracts/mobile.schemas";
import {
  applyAccessAgentIdsScope,
  applySupervisorSelfScope
} from "../dashboard/dashboard.routes.shared";
import {
  getSupervisorProducts,
  getSupervisorSummary,
  getSupervisorVisits
} from "../dashboard/dashboard.supervisor.snapshot.partials";
import { parseSupervisorDashboardFilters } from "../dashboard/dashboard.supervisor.scope";
import { listMobileSupervisorAgentLocations } from "./mobile.service";
import { getMobileAgentKpi } from "./mobile-agent-kpi.service";
import {
  assertAgentLinkedToSupervisor,
  getSupervisorTeamKpi,
  listSupervisorLinkedAgents
} from "./mobile-supervisor-kpi.service";
import {
  createMobileSupervisorClient,
  getMobileSupervisorClient,
  listMobileSupervisorClients,
  patchMobileSupervisorClient
} from "./mobile-supervisor-clients.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
import { workRegionTodayKey } from "./mobile-agent-sync.config.service";

export async function registerMobileSupervisorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/supervisor/summary",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      applySupervisorSelfScope(viewer, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, viewer, parsed);
      const data = await getSupervisorSummary(request.tenant!.id, parsed);
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/visits",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSupervisorDashboardFilters(q);
      applySupervisorSelfScope(viewer, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, viewer, parsed);
      const page = Number.parseInt(q.page ?? "1", 10) || 1;
      const limit = Number.parseInt(q.limit ?? "50", 10) || 50;
      const data = await getSupervisorVisits(request.tenant!.id, parsed, { page, limit });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/agent-locations",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const data = await listMobileSupervisorAgentLocations(request.tenant!.id, selfId);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/products",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      applySupervisorSelfScope(viewer, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, viewer, parsed);
      const data = await getSupervisorProducts(request.tenant!.id, parsed);
      return reply.send(data);
    }
  );

  /** Bog‘langan agentlar ro‘yxati */
  app.get(
    "/api/:slug/mobile/supervisor/agents",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const data = await listSupervisorLinkedAgents(request.tenant!.id, selfId);
      return reply.send({ data });
    }
  );

  /** SVR — faqat o‘z agentlarining mijozlari */
  app.get(
    "/api/:slug/mobile/supervisor/clients",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const q = request.query as Record<string, string | undefined>;
      const data = await listMobileSupervisorClients(request.tenant!.id, selfId, {
        q: q.q,
        limit: Number.parseInt(q.limit ?? "200", 10) || 200
      });
      return reply.send({ data });
    }
  );

  /** SVR — yangi mijoz + jamoa agentiga biriktirish */
  app.post(
    "/api/:slug/mobile/supervisor/clients",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const parsed = mobileCreateSupervisorClientBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const data = await createMobileSupervisorClient(request.tenant!.id, selfId, parsed.data);
        return reply.status(201).send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const uniq = clientUniqueHttp(msg);
        if (uniq) return sendApiError(reply, request, 409, uniq.error, uniq.message);
        if (msg === "CLIENT_CREATE_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Mijoz yaratish ruxsat etilmagan");
        }
        if (msg === "CLIENT_LOCATION_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Koordinatalarni o'zgartirish taqiqlangan");
        }
        if (msg === "AGENT_OUT_OF_SCOPE") {
          return sendApiError(
            reply,
            request,
            403,
            "AgentOutOfScope",
            "Agent sizning jamoangizga biriktirilmagan"
          );
        }
        if (msg === "AGENT_NOT_ON_SLOT") {
          return sendApiError(
            reply,
            request,
            403,
            "AgentNotOnSlot",
            "Agent ish joyiga biriktirilmagan — yangi mijoz yaratish taqiqlangan."
          );
        }
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/clients/:id",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) return sendApiError(reply, request, 400, "InvalidId");
      try {
        const data = await getMobileSupervisorClient(request.tenant!.id, selfId, idParsed.data.id);
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/mobile/supervisor/clients/:id",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) return sendApiError(reply, request, 400, "InvalidId");
      const bodyParsed = mobilePatchClientBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      try {
        const data = await patchMobileSupervisorClient(
          request.tenant!.id,
          selfId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        const uniq = clientUniqueHttp(msg);
        if (uniq) return sendApiError(reply, request, 409, uniq.error, uniq.message);
        if (msg === "CLIENT_EDIT_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Mijozni tahrirlash ruxsat etilmagan");
        }
        if (msg === "CLIENT_LOCATION_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Koordinatalarni o'zgartirish taqiqlangan");
        }
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  /** Jamoa KPI (yig‘indi) + agentlar bo‘yicha */
  app.get(
    "/api/:slug/mobile/supervisor/team-kpi",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const q = request.query as Record<string, string | undefined>;
      const month = (q.month ?? "").trim() || workRegionTodayKey().slice(0, 7);
      try {
        const data = await getSupervisorTeamKpi(request.tenant!.id, selfId, month);
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_MONTH") return sendApiError(reply, request, 400, "BadMonth");
        throw e;
      }
    }
  );

  /** Bitta bog‘langan agent KPI */
  app.get(
    "/api/:slug/mobile/supervisor/agent-kpi",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const selfId = Number.parseInt(viewer.sub, 10);
      if (!Number.isFinite(selfId)) return sendApiError(reply, request, 400, "BadUser");
      const q = request.query as Record<string, string | undefined>;
      const agentId = Number.parseInt(q.agent_id ?? "", 10);
      if (!Number.isFinite(agentId) || agentId <= 0) {
        return sendApiError(reply, request, 400, "AgentIdRequired");
      }
      const ok = await assertAgentLinkedToSupervisor(request.tenant!.id, selfId, agentId);
      if (!ok) return sendApiError(reply, request, 403, "AgentOutOfScope");
      const month = (q.month ?? "").trim() || undefined;
      try {
        const data = await getMobileAgentKpi(request.tenant!.id, agentId, month);
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_MONTH") return sendApiError(reply, request, 400, "BadMonth");
        throw e;
      }
    }
  );
}
