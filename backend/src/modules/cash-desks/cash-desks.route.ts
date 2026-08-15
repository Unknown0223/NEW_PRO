import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  isDirectoryIdAllowed,
  mergeDirectoryAllowedIds,
  resolveActorCashDeskDirectoryIds
} from "../access/access-directory-scope";
import {
  getAccessUser,
  jwtAccessVerify,
  requireAnyPermission
} from "../auth/auth.prehandlers";
import { getCashDeskAvailableCash } from "../stock/supplier-payment-cash.service";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import { createCashDesk, getCashDesk, listCashDesks, listCashDeskPickers, patchCashDesk } from "./cash-desks.service";
import {
  closeShift,
  getOpenShift,
  listShiftsForDesk,
  openShift
} from "./cash-desk-shifts.service";

/** Rol emas — Access kalitlari (operator lean default da cash yo‘q). */
const cashDeskView = requireAnyPermission([
  "cash.kassa.view",
  "cash.view",
  /** To‘lov / ish joyi pickerlari ham shu listni ishlatadi */
  "cash.oplaty_klientov.view",
  "cash.oplaty_klientov.create",
  "work_slots.raboche_mesto.view",
  "work_slots.raboche_mesto.create",
  "work_slots.raboche_mesto.update",
  "access.upravlenie.view",
  "access.manage"
]);
const cashDeskWrite = requireAnyPermission(["cash.kassa.create"]);
const cashDeskStatus = requireAnyPermission(["cash.kassa.status", "cash.kassa.create"]);
const cashDeskHistory = requireAnyPermission(["cash.kassa.history", "cash.kassa.view"]);

const linkSchema = z.object({
  user_id: z.number().int().positive(),
  link_role: z.enum([
    "agent",
    "cashier",
    "manager",
    "operator",
    "storekeeper",
    "supervisor",
    "expeditor"
  ])
});

const createBodySchema = z.object({
  name: z.string().min(1).max(500),
  timezone: z.string().max(64).optional(),
  sort_order: z.number().int().nullable().optional(),
  code: z.string().max(20).nullable().optional(),
  comment: z.string().max(5000).nullable().optional(),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
  is_active: z.boolean().optional(),
  is_closed: z.boolean().optional(),
  accepts_client_payments: z.boolean().optional(),
  accepts_discount_payments: z.boolean().optional(),
  links: z.array(linkSchema).optional()
});

const patchBodySchema = createBodySchema.partial();

export async function registerCashDeskRoutes(app: FastifyInstance) {
  app.get("/api/:slug/cash-desks/pickers", {
    preHandler: [jwtAccessVerify, cashDeskView]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const viewer = getAccessUser(request);
    const data = await listCashDeskPickers(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role ?? ""
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/cash-desks", {
    preHandler: [jwtAccessVerify, cashDeskView]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const q = z
      .object({
        is_active: z.enum(["true", "false"]).optional(),
        q: z.string().optional(),
        selected_agent_id: z.coerce.number().int().positive().optional(),
        selected_warehouse_id: z.coerce.number().int().positive().optional(),
        selected_cash_desk_id: z.coerce.number().int().positive().optional(),
        selected_expeditor_user_id: z.coerce.number().int().positive().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
      })
      .parse(request.query);
    const is_active = q.is_active === undefined ? undefined : q.is_active === "true";
    const selected = parseSelectedMastersFromQuery(
      request.query as Record<string, string | undefined>
    );
    const scope = await resolveConstraintScope(tenantId, selected);
    const viewer = getAccessUser(request);
    const actorIds = await resolveActorCashDeskDirectoryIds(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role
    });
    const result = await listCashDesks(tenantId, {
      is_active,
      q: q.q,
      allowed_ids: mergeDirectoryAllowedIds(
        actorIds,
        scope.constrained ? scope.cash_desk_ids : undefined
      ),
      page: q.page ?? 1,
      limit: q.limit ?? 10
    });
    return reply.send(result);
  });

  app.get("/api/:slug/cash-desks/:id", {
    preHandler: [jwtAccessVerify, cashDeskView]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const viewer = getAccessUser(request);
    const actorIds = await resolveActorCashDeskDirectoryIds(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role
    });
    if (!isDirectoryIdAllowed(actorIds, id)) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    const row = await getCashDesk(tenantId, id);
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    return reply.send({ data: row });
  });

  /** Mijoz kirimlari − rasxod − ta'minotchiga to'lovlar (stornosiz) — supplier payment dialog uchun */
  app.get("/api/:slug/cash-desks/:id/available-cash", {
    preHandler: [jwtAccessVerify, cashDeskView]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const viewer = getAccessUser(request);
    const actorIds = await resolveActorCashDeskDirectoryIds(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role
    });
    if (!isDirectoryIdAllowed(actorIds, id)) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    const row = await getCashDesk(tenantId, id);
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    const available = await getCashDeskAvailableCash(prisma, tenantId, id);
    return reply.send({ data: { available_cash: available.toDecimalPlaces(2).toString() } });
  });

  app.post("/api/:slug/cash-desks", {
    preHandler: [jwtAccessVerify, cashDeskWrite]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const body = createBodySchema.parse(request.body);
    try {
      const row = await createCashDesk(tenantId, body);
      const viewer = getAccessUser(request);
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: Number.parseInt(viewer.sub, 10),
        entityType: "cash_desk",
        entityId: row.id,
        action: "cash_desk.create",
        payload: { name: body.name, code: body.code ?? null, is_active: body.is_active ?? true }
      });
      return reply.status(201).send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "CodeTaken") return sendApiError(reply, request, 409, "CodeTaken");
      if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
      if (msg === "UserRoleMismatch" || msg === "InvalidLinkRole") {
        return sendApiError(reply, request, 400, msg);
      }
      if (msg === "CASH_DESK_OCCUPIED") {
        return sendApiError(reply, request, 409, "CashDeskOccupied");
      }
      if (msg === "CASH_DESK_PURPOSE_CONFLICT") {
        return sendApiError(reply, request, 400, "CashDeskPurposeConflict");
      }
      throw e;
    }
  });

  app.get("/api/:slug/cash-desks/:id/shifts", {
    preHandler: [jwtAccessVerify, cashDeskHistory]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const viewer = getAccessUser(request);
    const actorIds = await resolveActorCashDeskDirectoryIds(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role
    });
    if (!isDirectoryIdAllowed(actorIds, id)) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).parse(request.query);
    const rows = await listShiftsForDesk(tenantId, id, q.limit ?? 30);
    if (rows === null) return sendApiError(reply, request, 404, "NotFound");
    return reply.send({ data: rows });
  });

  app.get("/api/:slug/cash-desks/:id/shifts/open", {
    preHandler: [jwtAccessVerify, cashDeskHistory]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const viewer = getAccessUser(request);
    const actorIds = await resolveActorCashDeskDirectoryIds(tenantId, {
      userId: actorUserIdOrNull(request),
      role: viewer.role
    });
    if (!isDirectoryIdAllowed(actorIds, id)) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    const desk = await getCashDesk(tenantId, id);
    if (!desk) return sendApiError(reply, request, 404, "NotFound");
    const open = await getOpenShift(tenantId, id);
    return reply.send({ data: open });
  });

  const shiftOpenBody = z.object({
    opening_float: z.number().finite().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  });

  app.post("/api/:slug/cash-desks/:id/shifts/open", {
    preHandler: [jwtAccessVerify, cashDeskStatus]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const body = shiftOpenBody.parse(request.body ?? {});
    const viewer = getAccessUser(request);
    const uid = Number.parseInt(viewer.sub, 10);
    if (!Number.isFinite(uid) || uid < 1) return sendApiError(reply, request, 400, "BadUser");
    try {
      const row = await openShift(tenantId, id, uid, body);
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: uid,
        entityType: "cash_desk",
        entityId: id,
        action: "cash_desk.shift_open",
        payload: { cash_desk_id: id, shift_id: (row as { id?: number })?.id ?? null }
      });
      return reply.status(201).send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "CashDeskNotFound") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "ShiftAlreadyOpen") return sendApiError(reply, request, 409, "ShiftAlreadyOpen");
      if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
      throw e;
    }
  });

  const shiftCloseBody = z.object({
    closing_float: z.number().finite().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  });

  app.post("/api/:slug/cash-desks/:id/shifts/:shiftId/close", {
    preHandler: [jwtAccessVerify, cashDeskStatus]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const shiftId = z.coerce.number().int().positive().parse((request.params as { shiftId: string }).shiftId);
    const body = shiftCloseBody.parse(request.body ?? {});
    const viewer = getAccessUser(request);
    const uid = Number.parseInt(viewer.sub, 10);
    if (!Number.isFinite(uid) || uid < 1) return sendApiError(reply, request, 400, "BadUser");
    try {
      const row = await closeShift(tenantId, id, shiftId, uid, body);
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: uid,
        entityType: "cash_desk",
        entityId: id,
        action: "cash_desk.shift_close",
        payload: { cash_desk_id: id, shift_id: shiftId }
      });
      return reply.send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "ShiftNotFound") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "ShiftAlreadyClosed") return sendApiError(reply, request, 409, "ShiftAlreadyClosed");
      if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
      throw e;
    }
  });

  app.patch("/api/:slug/cash-desks/:id", {
    preHandler: [jwtAccessVerify, cashDeskWrite]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const body = patchBodySchema.parse(request.body);
    try {
      const row = await patchCashDesk(tenantId, id, body);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      const viewer = getAccessUser(request);
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: Number.parseInt(viewer.sub, 10),
        entityType: "cash_desk",
        entityId: id,
        action: "cash_desk.update",
        payload: { fields: Object.keys(body), ...body }
      });
      return reply.send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "CodeTaken") return sendApiError(reply, request, 409, "CodeTaken");
      if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
      if (msg === "UserRoleMismatch" || msg === "InvalidLinkRole") {
        return sendApiError(reply, request, 400, msg);
      }
      if (msg === "CASH_DESK_OCCUPIED") {
        return sendApiError(reply, request, 409, "CashDeskOccupied");
      }
      if (msg === "CASH_DESK_PURPOSE_CONFLICT") {
        return sendApiError(reply, request, 400, "CashDeskPurposeConflict");
      }
      throw e;
    }
  });
}
