import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  directionQuerySchema,
  optionsQuerySchema,
  saveApproverBodySchema
} from "./plans.schema";
import {
  getApproverConfig,
  listApproverOptions,
  saveApproverConfig
} from "./plans.approvers.service";
import {
  approvePlans,
  bulkSavePlanTargets,
  confirmPlans,
  getPlanningCenter,
  patchPlanTarget,
  returnPlansToDraft
} from "./plans.setup.service";
import {
  bulkSaveTargetsBodySchema,
  confirmPlansBodySchema,
  patchPlanTargetBodySchema,
  planningCenterQuerySchema
} from "./plans.setup.schema";
import { PLAN_APPROVER_ROLES, PLAN_SETTER_ROLES } from "./plans.setup.roles";

const manageRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES] as const;
const readRoles = [
  ...ADMIN_AND_OPERATOR_LIKE_ROLES,
  "supervisor",
  "commercial_director",
  "agent"
] as const;
const writeRoles = [...PLAN_SETTER_ROLES] as const;
const approveRoles = [...PLAN_APPROVER_ROLES] as const;

function mapApproverError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
) {
  const msg = e instanceof Error ? e.message : "";
  if (
    msg === "BAD_DIRECTION" ||
    msg === "BAD_USER" ||
    msg === "BAD_LEADER_ROLE" ||
    msg === "BAD_LEVEL_ROLE" ||
    msg === "BAD_SUPERVISOR"
  ) {
    return sendApiError(reply, request, 400, "ValidationError", msg);
  }
  throw e;
}

function mapSetupError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "BAD_DIRECTION" || msg === "BAD_DECIMAL" || msg === "PLAN_TARGET_READONLY") {
    return sendApiError(reply, request, 400, "ValidationError", msg);
  }
  if (msg === "NOT_FOUND") {
    return sendApiError(reply, request, 404, "NotFound", msg);
  }
  throw e;
}

export async function registerPlansRoutes(app: FastifyInstance) {
  const preRead = [jwtAccessVerify, requireRoles(...readRoles)];
  const preManage = [jwtAccessVerify, requireRoles(...manageRoles)];
  const preWrite = [jwtAccessVerify, requireRoles(...writeRoles)];
  const preApprove = [jwtAccessVerify, requireRoles(...approveRoles)];

  // Dropdownlar uchun tanlovlar (yo'nalishlar/supervayzerlar/xodimlar/rahbarlar).
  app.get("/api/:slug/plans/approvers/options", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = optionsQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const data = await listApproverOptions(request.tenant!.id, q.data.direction_id ?? null);
    return reply.send({ data });
  });

  // Tanlangan yo'nalish uchun saqlangan zanjir + rahbarlar.
  app.get("/api/:slug/plans/approvers", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = directionQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const data = await getApproverConfig(request.tenant!.id, q.data.direction_id);
    return reply.send({ data });
  });

  // Zanjirni to'liq saqlash (replace) + rahbarlarni almashtirish.
  app.put("/api/:slug/plans/approvers", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = directionQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const parsed = saveApproverBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await saveApproverConfig(
        request.tenant!.id,
        q.data.direction_id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapApproverError(reply, request, e);
    }
  });

  // ── Установка планов (KPI reja markazi): confirm → approve/return ──

  app.get("/api/:slug/plans/setup", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = planningCenterQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    try {
      const data = await getPlanningCenter(request.tenant!.id, q.data, actorUserIdOrNull(request));
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });

  app.patch("/api/:slug/plans/setup/targets/:id", { preHandler: preWrite }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const targetId = Number((request.params as { id: string }).id);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return sendApiError(reply, request, 400, "ValidationError", "BAD_ID");
    }
    const parsed = patchPlanTargetBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await patchPlanTarget(
        request.tenant!.id,
        targetId,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });

  app.put("/api/:slug/plans/setup/targets", { preHandler: preWrite }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = bulkSaveTargetsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await bulkSavePlanTargets(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });

  app.post("/api/:slug/plans/setup/confirm", { preHandler: preWrite }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = planningCenterQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const parsed = confirmPlansBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await confirmPlans(
        request.tenant!.id,
        q.data.month,
        q.data.year,
        q.data.direction_id,
        parsed.data.plan_ids,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });

  app.post("/api/:slug/plans/setup/approve", { preHandler: preApprove }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = planningCenterQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const parsed = confirmPlansBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await approvePlans(
        request.tenant!.id,
        q.data.month,
        q.data.year,
        q.data.direction_id,
        parsed.data.plan_ids,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });

  app.post("/api/:slug/plans/setup/return", { preHandler: preApprove }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = planningCenterQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const parsed = confirmPlansBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await returnPlansToDraft(
        request.tenant!.id,
        q.data.month,
        q.data.year,
        q.data.direction_id,
        parsed.data.plan_ids,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapSetupError(reply, request, e);
    }
  });
}
