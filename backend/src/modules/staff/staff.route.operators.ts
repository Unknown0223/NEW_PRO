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

export async function registerStaffOperatorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/operators",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const filters = parseOperatorListFilters(q);
      const data = await listStaff(request.tenant!.id, "operator", filters);
      return reply.send({ data });
    }
  );

  /** `meta` — `:id` bilan adashmasligi uchun (masalan filter-options). */
  app.get(
    "/api/:slug/operators/meta/filter-options",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listWebPanelStaffFilterOptions(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/operators/meta/position-presets",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      try {
        const data = await listWebStaffPositionPresetsAdmin(request.tenant!.id);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  /** Statik `history` UUID dan oldin — ba’zi muhitlarda `:presetId/history` 404 berardi */
  app.get(
    "/api/:slug/operators/meta/position-presets/history/:presetId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const presetId = (request.params as { presetId?: string }).presetId ?? "";
      try {
        const result = await listWebStaffPositionPresetHistory(request.tenant!.id, presetId);
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_PRESET_ID") return sendApiError(reply, request, 400, "BadPresetId");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/operators/meta/position-presets",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createWebStaffPositionPresetBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await createWebStaffPositionPreset(
          request.tenant!.id,
          parsed.data.label,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send({ data: row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_LABEL") return sendApiError(reply, request, 400, "BadLabel");
        if (msg === "PRESET_LIMIT") return sendApiError(reply, request, 400, "PresetLimit");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/operators/meta/position-presets/:presetId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const presetId = (request.params as { presetId?: string }).presetId ?? "";
      const parsed = patchWebStaffPositionPresetBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchWebStaffPositionPreset(
          request.tenant!.id,
          presetId,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_PRESET_ID") return sendApiError(reply, request, 400, "BadPresetId");
        if (msg === "BAD_LABEL") return sendApiError(reply, request, 400, "BadLabel");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/operators/bulk/sessions/revoke",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkWebPanelRevokeBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        await bulkRevokeWebPanelStaffSessions(
          request.tenant!.id,
          parsed.data.user_ids,
          actorUserIdOrNull(request)
        );
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "EmptyIds");
        if (msg === "BAD_USER_IDS") return sendApiError(reply, request, 400, "BadUserIds");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/operators/bulk/max-sessions",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkWebPanelMaxSessionsBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        await bulkPatchWebPanelStaffMaxSessions(
          request.tenant!.id,
          parsed.data.updates,
          actorUserIdOrNull(request)
        );
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "EmptyIds");
        if (msg === "BAD_USER_IDS") return sendApiError(reply, request, 400, "BadUserIds");
        if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
        if (msg === "TOO_MANY_UPDATES") return sendApiError(reply, request, 400, "TooManyUpdates");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/operators/:id(\\d+)",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getStaffRow(request.tenant!.id, "operator", id);
      if (!row) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      return reply.send({ data: row });
    }
  );

  app.post(
    "/api/:slug/operators",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createOperatorBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const { web_access_role: webAccessRole, ...staffInput } = parsed.data;
        const kind: StaffKind = (webAccessRole ?? "operator") as StaffKind;
        const row = await createStaff(request.tenant!.id, kind, staffInput, actorUserIdOrNull(request));
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_LOGIN") return sendApiError(reply, request, 400, "BadLogin");
        if (msg === "BAD_PASSWORD") return sendApiError(reply, request, 400, "BadPassword");
        if (msg === "BAD_FIRST_NAME") return sendApiError(reply, request, 400, "BadFirstName");
        if (msg === "LOGIN_EXISTS") return sendApiError(reply, request, 409, "LoginExists");
        if (msg === "CASH_DESK_OPERATOR_ONLY") return sendApiError(reply, request, 400, "CashDeskOperatorOnly");
        if (msg === "CashDeskNotFound") return sendApiError(reply, request, 400, "CashDeskNotFound");
        if (msg === "UserRoleMismatch") return sendApiError(reply, request, 400, "UserRoleMismatch");
        if (msg === "InvalidLinkRole") return sendApiError(reply, request, 400, "InvalidLinkRole");
        if (msg === "CashDeskUserLinkExists") return sendApiError(reply, request, 409, "CashDeskUserLinkExists");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/operators/:id(\\d+)",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchOperatorBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchOperator(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_PASSWORD") return sendApiError(reply, request, 400, "BadPassword");
        if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/operators/:id(\\d+)/sessions",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await listStaffSessions(request.tenant!.id, id, "operator");
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/operators/:id(\\d+)/sessions/revoke",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
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
          await revokeStaffSessions(request.tenant!.id, id, "operator", { all: true }, actorUserIdOrNull(request));
        } else if ("token_ids" in parsed.data) {
          await revokeStaffSessions(
            request.tenant!.id,
            id,
            "operator",
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
}
