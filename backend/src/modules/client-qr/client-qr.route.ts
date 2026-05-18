import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  bindQrCode,
  exportClientsWithoutQrCsv,
  exportQrCodesCsv,
  generateQrCodes,
  getClientQrStats,
  listClientsWithoutQr,
  listQrCodesForTenant,
  markQrCodesPrinted,
  unbindQrCode,
  type QrListQuery
} from "./client-qr.service";

const manageRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

const generateBodySchema = z.object({
  count: z.number().int().min(1).max(20_000).optional(),
  client_ids: z.array(z.number().int().positive()).max(20_000).optional()
});

const bindBodySchema = z.object({
  qr_id: z.number().int().positive(),
  client_id: z.number().int().positive()
});

const unbindBodySchema = z.object({
  qr_id: z.number().int().positive()
});

const printedBodySchema = z.object({
  qr_ids: z.array(z.number().int().positive()).min(1).max(20_000),
  qr_size_label: z.string().max(64).optional()
});

function parseStatuses(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const allowed = new Set(["new", "printed", "attached", "detached"]);
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s === "ready_to_print" ? "new" : s))
    .filter((s) => allowed.has(s));
  return parts.length ? [...new Set(parts)] : undefined;
}

function parseListQuery(raw: Record<string, string | undefined>): QrListQuery {
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(raw.limit ?? "50", 10) || 50));
  const statuses = parseStatuses(raw.statuses);
  const statusRaw = raw.status?.trim().toLowerCase();
  const status =
    !statuses &&
    (statusRaw === "new" ||
      statusRaw === "printed" ||
      statusRaw === "attached" ||
      statusRaw === "detached" ||
      statusRaw === "ready_to_print")
      ? statusRaw === "ready_to_print"
        ? "new"
        : (statusRaw as QrListQuery["status"])
      : undefined;
  const dateTypeRaw = raw.date_type?.trim().toLowerCase();
  const date_type = dateTypeRaw === "attached_date" ? "attached_date" : "created_date";
  const ar = raw.attached?.trim().toLowerCase();
  const attached = ar === "yes" || ar === "true" || ar === "1" ? "yes" : ar === "no" || ar === "false" || ar === "0" ? "no" : undefined;
  return {
    page,
    limit,
    ...(statuses?.length ? { statuses } : {}),
    ...(status ? { status } : {}),
    ...(attached ? { attached } : {}),
    date_type,
    search: raw.search?.trim() || undefined,
    from: raw.from?.trim() || undefined,
    to: raw.to?.trim() || undefined,
    zone: raw.zone?.trim() || undefined,
    region: raw.region?.trim() || undefined,
    city: raw.city?.trim() || undefined
  };
}

function parseClientsWithoutQrQuery(raw: Record<string, string | undefined>) {
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(raw.limit ?? "50", 10) || 50));
  return {
    page,
    limit,
    search: raw.search?.trim() || undefined,
    zone: raw.zone?.trim() || undefined,
    region: raw.region?.trim() || undefined,
    city: raw.city?.trim() || undefined
  };
}

export async function registerClientQrRoutes(app: FastifyInstance) {
  app.get("/api/:slug/client-qr-codes/stats", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getClientQrStats(request.tenant!.id);
    return reply.send(data);
  });

  app.get(
    "/api/:slug/client-qr-codes/clients-without-qr",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseClientsWithoutQrQuery(request.query as Record<string, string | undefined>);
      const data = await listClientsWithoutQr(request.tenant!.id, q);
      return reply.send(data);
    }
  );

  app.get("/api/:slug/client-qr-codes", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseListQuery(request.query as Record<string, string | undefined>);
    const data = await listQrCodesForTenant(request.tenant!.id, q);
    return reply.send(data);
  });

  app.get(
    "/api/:slug/client-qr-codes/clients-without-qr/export",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseClientsWithoutQrQuery(request.query as Record<string, string | undefined>);
      const csv = await exportClientsWithoutQrCsv(request.tenant!.id, q);
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", 'attachment; filename="clients-without-qr.csv"')
        .send(csv);
    }
  );

  app.get(
    "/api/:slug/client-qr-codes/export",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseListQuery(request.query as Record<string, string | undefined>);
      const csv = await exportQrCodesCsv(request.tenant!.id, q);
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", 'attachment; filename="client-qr-codes.csv"')
        .send(csv);
    }
  );

  app.post(
    "/api/:slug/client-qr-codes/generate",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = generateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorId = Number.parseInt(actor.sub, 10);
      const res = await generateQrCodes({
        tenantId: request.tenant!.id,
        actorUserId: Number.isFinite(actorId) && actorId > 0 ? actorId : null,
        count: parsed.data.count,
        clientIds: parsed.data.client_ids
      });
      return reply.status(201).send(res);
    }
  );

  app.post(
    "/api/:slug/client-qr-codes/bind",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bindBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorId = Number.parseInt(actor.sub, 10);
      try {
        await bindQrCode({
          tenantId: request.tenant!.id,
          actorUserId: Number.isFinite(actorId) && actorId > 0 ? actorId : null,
          qrId: parsed.data.qr_id,
          clientId: parsed.data.client_id
        });
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/client-qr-codes/unbind",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = unbindBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorId = Number.parseInt(actor.sub, 10);
      try {
        await unbindQrCode({
          tenantId: request.tenant!.id,
          actorUserId: Number.isFinite(actorId) && actorId > 0 ? actorId : null,
          qrId: parsed.data.qr_id
        });
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/client-qr-codes/mark-printed",
    { preHandler: [jwtAccessVerify, requireRoles(...manageRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = printedBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorId = Number.parseInt(actor.sub, 10);
      const res = await markQrCodesPrinted({
        tenantId: request.tenant!.id,
        actorUserId: Number.isFinite(actorId) && actorId > 0 ? actorId : null,
        qrIds: parsed.data.qr_ids,
        qrSizeLabel: parsed.data.qr_size_label
      });
      return reply.send(res);
    }
  );
}
