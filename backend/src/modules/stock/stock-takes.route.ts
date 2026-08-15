import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableById } from "../../lib/document-edit-lock.request";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { DIRECTORY_READ_ROLES, getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  cancelStockTake,
  createStockTake,
  getStockTake,
  listStockTakes,
  postStockTake,
  setStockTakeLines
} from "./stock-takes.service";

const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const lineSchema = z.object({
  product_id: z.number().int().positive(),
  counted_qty: z.number().finite().nullable()
});

export async function registerStockTakeRoutes(app: FastifyInstance) {
  app.get("/api/:slug/stock-takes", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const q = z
      .object({
        warehouse_id: z.coerce.number().int().positive().optional(),
        status: z.string().max(32).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional()
      })
      .parse(request.query);
    const result = await listStockTakes(tenantId, {
      warehouse_id: q.warehouse_id,
      status: q.status,
      page: q.page ?? 1,
      limit: q.limit ?? 20
    });
    return reply.send(result);
  });

  app.get("/api/:slug/stock-takes/:id", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const row = await getStockTake(tenantId, id);
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    return reply.send({ data: row });
  });

  app.post("/api/:slug/stock-takes", {
    preHandler: [jwtAccessVerify, requireRoles(...writeRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const body = z
      .object({
        warehouse_id: z.number().int().positive(),
        title: z.string().max(500).nullable().optional(),
        notes: z.string().max(5000).nullable().optional()
      })
      .parse(request.body);
    const viewer = getAccessUser(request);
    const uid = Number.parseInt(viewer.sub, 10);
    try {
      const row = await createStockTake(
        tenantId,
        Number.isFinite(uid) && uid > 0 ? uid : undefined,
        body
      );
      await appendTenantAuditEvent({
        tenantId,
        actorUserId: Number.isFinite(uid) && uid > 0 ? uid : null,
        entityType: "stock_take",
        entityId: (row as { id?: number })?.id ?? "—",
        action: "stock_take.create",
        payload: { warehouse_id: body.warehouse_id, title: body.title ?? null }
      });
      return reply.status(201).send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "WarehouseNotFound") return sendApiError(reply, request, 400, "WarehouseNotFound");
      throw e;
    }
  });

  app.put("/api/:slug/stock-takes/:id/lines", {
    preHandler: [jwtAccessVerify, requireRoles(...writeRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const body = z.object({ lines: z.array(lineSchema) }).parse(request.body);
    try {
      await assertDocWritableById(request, "stock", id, "stock_take");
      const row = await setStockTakeLines(tenantId, id, body.lines);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NotDraft") return sendApiError(reply, request, 409, "NotDraft");
      if (msg === "ProductNotFound") return sendApiError(reply, request, 400, "ProductNotFound");
      throw e;
    }
  });

  app.post("/api/:slug/stock-takes/:id/post", {
    preHandler: [jwtAccessVerify, requireRoles(...writeRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    try {
      await assertDocWritableById(request, "stock", id, "stock_take");
      const row = await postStockTake(tenantId, id, actorUserIdOrNull(request));
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NotDraft") return sendApiError(reply, request, 409, "NotDraft");
      if (msg === "NoLines") return sendApiError(reply, request, 400, "NoLines");
      if (msg === "IncompleteLines") return sendApiError(reply, request, 400, "IncompleteLines");
      throw e;
    }
  });

  app.post("/api/:slug/stock-takes/:id/cancel", {
    preHandler: [jwtAccessVerify, requireRoles(...writeRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    try {
      await assertDocWritableById(request, "stock", id, "stock_take");
      const row = await cancelStockTake(tenantId, id, actorUserIdOrNull(request));
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NotDraft") return sendApiError(reply, request, 409, "NotDraft");
      if (msg === "AlreadyCancelled") return sendApiError(reply, request, 409, "AlreadyCancelled");
      if (msg === "NotCancellable") return sendApiError(reply, request, 409, "NotCancellable");
      if (msg === "CANNOT_CANCEL_POSTED_NO_SNAPSHOT") {
        return sendApiError(
          reply,
          request,
          409,
          "CannotCancelPostedNoSnapshot",
          "Нельзя отменить проведённую инвентаризацию: нет снимка остатков до проведения (previous_qty)."
        );
      }
      throw e;
    }
  });
}
