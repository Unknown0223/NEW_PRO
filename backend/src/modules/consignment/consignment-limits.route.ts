import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { ensureAnyPermission } from "../access/ensure-any-permission";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { LIMIT_ROUND_STEPS, type LimitRound } from "./consignment-limits.pure";
import {
  applyConsignmentLimits,
  buildConsignmentLimitProposal,
  ConsignmentLimitError,
  transferConsignmentLimit
} from "./consignment-limits.service";

const TRANSFER_PERMISSION = "staff.konsignatsiya_perekid.update";
const BULK_PERMISSION = "staff.konsignatsiya_limity.update";
const amountSchema = z.string().trim().regex(/^\d+(\.\d{1,2})?$/);

const transferSchema = z.object({
  from_user_id: z.number().int().positive(),
  to_user_id: z.number().int().positive(),
  amount: amountSchema
});

const proposalSchema = z.object({
  source: z.enum(["month", "plan"]),
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  percent: z.coerce.number().positive().max(1000).optional(),
  round: z.coerce
    .number()
    .refine((v): v is LimitRound => (LIMIT_ROUND_STEPS as readonly number[]).includes(v))
    .optional(),
  trade_direction_id: z.coerce.number().int().positive(),
  supervisor_user_id: z.coerce.number().int().positive().optional(),
  agents_without_supervisor: z.union([z.literal("1"), z.literal("true")]).optional()
});

const applySchema = z.object({
  rows: z.array(z.object({ user_id: z.number().int().positive(), limit_amount: amountSchema })).min(1).max(500),
  source: z.enum(["month", "plan"]),
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  percent: z.number().positive().optional()
});

const ERROR_STATUS: Record<string, [number, string]> = {
  BAD_AMOUNT: [400, "Укажите сумму больше нуля"],
  SAME_AGENT: [400, "Выберите разных агентов"],
  DUPLICATE_AGENT: [400, "Агент указан несколько раз"],
  AGENT_OUT_OF_SCOPE: [403, "Агент недоступен или неактивен"],
  DIFFERENT_SUPERVISOR: [409, "Агенты должны быть у одного супервайзера"],
  SOURCE_NO_LIMIT: [409, "У агента не задан лимит — уменьшать нечего"],
  AMOUNT_EXCEEDS_AVAILABLE: [409, "Сумма больше свободного остатка лимита"],
  NO_WORKPLACE: [409, "Агент не назначен на рабочее место"]
};

function handleError(e: unknown, request: FastifyRequest, reply: FastifyReply) {
  const code = e instanceof ConsignmentLimitError ? e.code : e instanceof Error ? e.message : "";
  const hit = ERROR_STATUS[code];
  if (!hit) throw e;
  const extra = e instanceof ConsignmentLimitError ? e.extra : {};
  return sendApiError(reply, request, hit[0], code, hit[1], extra);
}

function actorOf(request: FastifyRequest) {
  return { userId: actorUserIdOrNull(request), role: getAccessUser(request).role ?? "" };
}

export async function registerConsignmentLimitRoutes(app: FastifyInstance) {
  const preHandler = [jwtAccessVerify, requireRoles(...ADMIN_AND_OPERATOR_LIKE_ROLES)];

  app.post("/api/:slug/consignment/limits/transfer", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    if (!(await ensureAnyPermission(request, reply, [TRANSFER_PERMISSION]))) return;
    const parsed = transferSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    try {
      return reply.send({ data: await transferConsignmentLimit(request.tenant!.id, parsed.data, actorOf(request)) });
    } catch (e) {
      return handleError(e, request, reply);
    }
  });

  app.get("/api/:slug/consignment/limits/proposal", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    if (!(await ensureAnyPermission(request, reply, [BULK_PERMISSION]))) return;
    const parsed = proposalSchema.safeParse(request.query ?? {});
    if (!parsed.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    const { agents_without_supervisor: aw, ...q } = parsed.data;
    const rows = await buildConsignmentLimitProposal(request.tenant!.id, { ...q, agents_without_supervisor: aw ? true : undefined }, actorOf(request));
    return reply.send({ data: rows });
  });

  app.post("/api/:slug/consignment/limits/apply", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    if (!(await ensureAnyPermission(request, reply, [BULK_PERMISSION]))) return;
    const parsed = applySchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    const { rows, ...meta } = parsed.data;
    try {
      return reply.send({ data: await applyConsignmentLimits(request.tenant!.id, rows, actorOf(request), meta) });
    } catch (e) {
      return handleError(e, request, reply);
    }
  });
}
