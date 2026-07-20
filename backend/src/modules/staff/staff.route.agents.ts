import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { DIRECTORY_READ_ROLES, getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import type { BulkAgentsInput, ListStaffFilters } from "./staff.service";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  bulkPatchAgents,
  bulkPatchWebPanelStaffMaxSessions,
  bulkRevokeWebPanelStaffSessions,
  createStaff,
  getStaffRow,
  listAgentFilterOptions,
  listAgentSessions,
  listAuditorFilterOptions,
  listCollectorFilterOptions,
  listExpeditorFilterOptions,
  listStaff,
  listStaffSessions,
  listSupervisorFilterOptions,
  listWebPanelStaffFilterOptions,
  listWebStaffPositionPresetsAdmin,
  listWebStaffPositionPresetHistory,
  createWebStaffPositionPreset,
  patchWebStaffPositionPreset,
  patchAgent,
  patchAuditor,
  patchCollector,
  patchExpeditor,
  patchOperator,
  patchSkladchik,
  patchSupervisor,
  revokeAgentSessions,
  revokeStaffSessions,
  type StaffKind
} from "./staff.service";
import { catalogRoles, adminRoles } from "./staff.route.shared";
import { buildScopedAgentDirectoryWhereForActor } from "../access/access-agent-scope";
import {
  agentEntitlementsPayloadSchema,
  agentEntitlementsSchema,
  createBodySchema,
  patchStaffMutableBody,
  expeditorAssignmentRulesSchema,
  patchExpeditorBody,
  patchSupervisorBody,
  patchCollectorBody,
  patchAuditorBody,
  patchAgentBody,
  bulkAgentIds,
  bulkAgentsBody,
  revokeSessionsBody,
  parseAgentListFilters,
  parseExpeditorListFilters,
  parseSupervisorListFilters,
  parseCollectorListFilters,
  parseAuditorListFilters,
  parseOperatorListFilters,
  parseSkladchikListFilters,
  operatorLikeRoleEnum,
  createOperatorBodySchema,
  patchOperatorBody,
  createSkladchikBodySchema,
  patchSkladchikBody,
  bulkWebPanelRevokeBody,
  bulkWebPanelMaxSessionsBody,
  createWebStaffPositionPresetBody,
  patchWebStaffPositionPresetBody
} from "./staff.route.schemas";

export async function registerStaffAgentRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/agents/filter-options",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listAgentFilterOptions(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get("/api/:slug/agents", { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const filters = parseAgentListFilters(q);
    const actor = getAccessUser(request);
    const accessScope = await buildScopedAgentDirectoryWhereForActor(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: actor.role ?? ""
    });
    const data = await listStaff(request.tenant!.id, "agent", filters, accessScope);
    return reply.send({ data });
  });

  app.get(
    "/api/:slug/agents/:id/sessions",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await listAgentSessions(request.tenant!.id, id);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/agents/:id/sessions/revoke",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = revokeSessionsBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        if ("all" in parsed.data && parsed.data.all) {
          await revokeAgentSessions(request.tenant!.id, id, { all: true }, actorUserIdOrNull(request));
        } else if ("token_ids" in parsed.data) {
          await revokeAgentSessions(
            request.tenant!.id,
            id,
            { tokenIds: parsed.data.token_ids },
            actorUserIdOrNull(request)
          );
        }
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "EMPTY_REVOKE") return sendApiError(reply, request, 400, "EmptyRevoke");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/agents/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getStaffRow(request.tenant!.id, "agent", id);
      if (!row) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      return reply.send({ data: row });
    }
  );

  app.post("/api/:slug/agents", { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
    }
    try {
      const row = await createStaff(request.tenant!.id, "agent", parsed.data, actorUserIdOrNull(request));
      return reply.status(201).send(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_LOGIN") return sendApiError(reply, request, 400, "BadLogin");
      if (msg === "BAD_PASSWORD") return sendApiError(reply, request, 400, "BadPassword");
      if (msg === "BAD_FIRST_NAME") return sendApiError(reply, request, 400, "BadFirstName");
      if (msg === "LOGIN_EXISTS") return sendApiError(reply, request, 409, "LoginExists");
      if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
      if (msg === "BAD_RETURN_WAREHOUSE") return sendApiError(reply, request, 400, "BadReturnWarehouse");
      if (msg === "WORK_SLOT_REQUIRED") {
        return sendApiError(
          reply,
          request,
          400,
          "WorkSlotRequired",
          "Рабочее место обязательно — назначьте свободный слот"
        );
      }
      if (msg === "BAD_TRADE_DIRECTION") return sendApiError(reply, request, 400, "BadTradeDirection");
      if (msg === "BAD_ENTITLEMENT_CATEGORY" || msg === "BAD_ENTITLEMENT_PRODUCT") {
        return sendApiError(reply, request, 400, "BadEntitlements");
      }
      if (
        msg === "NOT_FOUND" ||
        msg === "BAD_USER" ||
        msg === "BAD_SLOT_TYPE" ||
        msg === "SLOT_INACTIVE"
      ) {
        return sendApiError(reply, request, 400, "WorkSlotAssignFailed", msg);
      }
      throw e;
    }
  });

  app.patch(
    "/api/:slug/agents/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchAgentBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchAgent(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "SELF_SUPERVISOR") return sendApiError(reply, request, 400, "SelfSupervisor");
        if (msg === "BAD_SUPERVISOR") return sendApiError(reply, request, 400, "BadSupervisor");
        if (msg === "AGENT_ALREADY_ASSIGNED") {
          return sendApiError(
            reply,
            request,
            409,
            "AgentAlreadyAssigned",
            "Агент уже привязан к другому супервайзеру"
          );
        }
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_RETURN_WAREHOUSE") return sendApiError(reply, request, 400, "BadReturnWarehouse");
        if (msg === "BAD_TRADE_DIRECTION") return sendApiError(reply, request, 400, "BadTradeDirection");
        if (msg === "BAD_PASSWORD") return sendApiError(reply, request, 400, "BadPassword");
        if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
        if (msg === "BAD_LIMIT") return sendApiError(reply, request, 400, "BadLimit");
        if (msg === "BAD_ENTITLEMENT_CATEGORY" || msg === "BAD_ENTITLEMENT_PRODUCT") {
          return sendApiError(reply, request, 400, "BadEntitlements");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/agents/bulk",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkAgentsBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const data = await bulkPatchAgents(
          request.tenant!.id,
          parsed.data as BulkAgentsInput,
          actorUserIdOrNull(request)
        );
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "EmptyIds");
        if (msg === "TOO_MANY_AGENTS") return sendApiError(reply, request, 400, "TooManyAgents");
        if (msg === "BAD_AGENT_IDS") return sendApiError(reply, request, 400, "BadAgentIds");
        if (msg === "BAD_TRADE_DIRECTION") return sendApiError(reply, request, 400, "BadTradeDirection");
        if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
        if (msg === "BAD_DELTA") return sendApiError(reply, request, 400, "BadDelta");
        if (msg === "EMPTY_PRODUCT_PATCH") return sendApiError(reply, request, 400, "EmptyProductPatch");
        if (msg === "BAD_CATEGORY") return sendApiError(reply, request, 400, "BadCategory");
        if (msg === "BAD_ENTITLEMENT_CATEGORY" || msg === "BAD_ENTITLEMENT_PRODUCT") {
          return sendApiError(reply, request, 400, "BadEntitlements");
        }
        if (msg === "BAD_BULK_ACTION") return sendApiError(reply, request, 400, "BadBulkAction");
        if (msg === "BAD_CLOSE_DAY") return sendApiError(reply, request, 400, "BadCloseDay");
        if (msg === "BAD_CLOSE_HOUR") return sendApiError(reply, request, 400, "BadCloseHour");
        if (msg === "BAD_CLOSE_MINUTE") return sendApiError(reply, request, 400, "BadCloseMinute");
        if (msg === "BAD_MOBILE_CONFIG_PATCH") return sendApiError(reply, request, 400, "BadMobileConfigPatch");
        if (msg === "BAD_MOBILE_CONFIG_SYNC_WINDOW") {
          return sendApiError(reply, request, 400, "BadMobileConfigSyncWindow");
        }
        if (msg.startsWith("BAD_MOBILE_CONFIG")) {
          return sendApiError(reply, request, 400, "BadMobileConfigPatch", msg);
        }
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );
}
