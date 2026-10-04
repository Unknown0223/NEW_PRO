import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify, requireAnyPermission } from "../auth/auth.prehandlers";
import { LOGIN_ALERTS_VIEW } from "./login-alerts.detect";
import { LOGIN_ALERT_KINDS, LOGIN_ALERT_RISKS, LOGIN_ALERT_STATUSES } from "./login-alerts.pure";
import {
  addIpWhitelist,
  deleteIpWhitelist,
  getLoginAlert,
  listIpWhitelist,
  listLoginAlerts,
  reviewLoginAlert,
  revokeUserSessions
} from "./login-alerts.service";

const VIEW = LOGIN_ALERTS_VIEW;
const UPDATE = "audit.podozritelnye_vhody.update";
const CREATE = "audit.podozritelnye_vhody.create";
const DELETE = "audit.podozritelnye_vhody.delete";
const EXPORT = "audit.podozritelnye_vhody.export";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuerySchema = z.object({
  status: z.enum([...LOGIN_ALERT_STATUSES, "all"]).optional(),
  risk: z.enum(LOGIN_ALERT_RISKS).optional(),
  kind: z.enum(LOGIN_ALERT_KINDS).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const reviewSchema = z.object({
  status: z.enum(LOGIN_ALERT_STATUSES),
  note: z.string().max(2000).nullable().optional()
});

const revokeSchema = z.object({ user_id: z.number().int().positive() });

const whitelistSchema = z.object({
  cidr: z.string().trim().min(3).max(64),
  label: z.string().max(255).nullable().optional()
});

const ERRORS: Record<string, [number, string, string?]> = {
  NOT_FOUND: [404, "NotFound"],
  USER_NOT_IN_ALERT: [400, "UserNotInAlert"],
  INVALID_IP: [400, "InvalidIp", "Укажите IP (213.230.1.5) или подсеть (213.230.1.0/24)"],
  DUPLICATE_IP: [409, "DuplicateIp", "Этот IP уже в белом списке"]
};

function sendError(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const hit = e instanceof Error ? ERRORS[e.message] : undefined;
  if (!hit) throw e;
  return sendApiError(reply, request, hit[0], hit[1], hit[2]);
}

function dayBound(v: string | undefined, end: boolean): Date | undefined {
  return v ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}+05:00`) : undefined;
}

function parseList(request: FastifyRequest, reply: FastifyReply, maxLimit?: number) {
  const q = listQuerySchema.safeParse(request.query ?? {});
  if (!q.success) {
    sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    return null;
  }
  const { from, to, ...rest } = q.data;
  return { ...rest, ...(maxLimit ? { page: 1, limit: maxLimit } : {}), from: dayBound(from, false), to: dayBound(to, true) };
}

export async function registerLoginAlertRoutes(app: FastifyInstance) {
  const pre = (keys: string[]) => ({ preHandler: [jwtAccessVerify, requireAnyPermission(keys)] });

  app.get("/api/:slug/security/login-alerts", pre([VIEW]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const f = parseList(request, reply);
    if (!f) return;
    return reply.send(await listLoginAlerts(request.tenant!.id, f));
  });

  app.get("/api/:slug/security/login-alerts/export", pre([EXPORT]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const f = parseList(request, reply, 5000);
    if (!f) return;
    return reply.send(await listLoginAlerts(request.tenant!.id, f));
  });

  app.get("/api/:slug/security/login-alerts/:id", pre([VIEW]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      return reply.send({ data: await getLoginAlert(request.tenant!.id, p.data.id) });
    } catch (e) {
      return sendError(reply, request, e);
    }
  });

  app.post("/api/:slug/security/login-alerts/:id/review", pre([UPDATE]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    const body = reviewSchema.safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    try {
      const actorId = Number(getAccessUser(request).sub);
      return reply.send({ data: await reviewLoginAlert(request.tenant!.id, p.data.id, actorId, body.data) });
    } catch (e) {
      return sendError(reply, request, e);
    }
  });

  app.post("/api/:slug/security/login-alerts/:id/revoke-sessions", pre([UPDATE]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    const body = revokeSchema.safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    try {
      return reply.send({ data: await revokeUserSessions(request.tenant!.id, p.data.id, body.data.user_id) });
    } catch (e) {
      return sendError(reply, request, e);
    }
  });

  app.get("/api/:slug/security/ip-whitelist", pre([VIEW, CREATE, DELETE]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    return reply.send({ data: await listIpWhitelist(request.tenant!.id) });
  });

  app.post("/api/:slug/security/ip-whitelist", pre([CREATE]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = whitelistSchema.safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    try {
      const actorId = Number(getAccessUser(request).sub);
      return reply.status(201).send({ data: await addIpWhitelist(request.tenant!.id, actorId, body.data) });
    } catch (e) {
      return sendError(reply, request, e);
    }
  });

  app.delete("/api/:slug/security/ip-whitelist/:id", pre([DELETE]), async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      await deleteIpWhitelist(request.tenant!.id, p.data.id);
      return reply.send({ ok: true });
    } catch (e) {
      return sendError(reply, request, e);
    }
  });
}
