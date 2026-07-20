import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { DIRECTORY_READ_ROLES, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
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

export async function registerStaffExpeditorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/expeditors/filter-options",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listExpeditorFilterOptions(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/expeditors",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const filters = parseExpeditorListFilters(q);
      const data = await listStaff(request.tenant!.id, "expeditor", filters);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/expeditors/:id/sessions",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await listStaffSessions(request.tenant!.id, id, "expeditor");
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/expeditors/:id/sessions/revoke",
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
          await revokeStaffSessions(request.tenant!.id, id, "expeditor", { all: true }, actorUserIdOrNull(request));
        } else if ("token_ids" in parsed.data) {
          await revokeStaffSessions(
            request.tenant!.id,
            id,
            "expeditor",
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
    "/api/:slug/expeditors/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getStaffRow(request.tenant!.id, "expeditor", id);
      if (!row) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      return reply.send({ data: row });
    }
  );

  app.patch(
    "/api/:slug/expeditors/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchExpeditorBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchExpeditor(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
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
        if (msg === "BAD_PASSWORD") return sendApiError(reply, request, 400, "BadPassword");
        if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
        if (msg === "BAD_EXPEDITOR_RULE_AGENT") return sendApiError(reply, request, 400, "BadExpeditorRuleAgent");
        if (msg === "BAD_EXPEDITOR_RULE_WAREHOUSE") {
          return sendApiError(reply, request, 400, "BadExpeditorRuleWarehouse");
        }
        if (msg === "BAD_ENTITLEMENT_CATEGORY" || msg === "BAD_ENTITLEMENT_PRODUCT") {
          return sendApiError(reply, request, 400, "BadEntitlements");
        }
        if (msg === "BAD_EXPEDITOR_MOBILE_TRADE_DIRECTION") {
          return sendApiError(reply, request, 400, "BadExpeditorMobileTradeDirection");
        }
        if (msg.startsWith("BAD_MOBILE_CONFIG")) {
          return sendApiError(reply, request, 400, "BadMobileConfig", undefined, { code: msg });
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/expeditors",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await createStaff(
          request.tenant!.id,
          "expeditor",
          parsed.data,
          actorUserIdOrNull(request)
        );
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
        throw e;
      }
    }
  );
}
