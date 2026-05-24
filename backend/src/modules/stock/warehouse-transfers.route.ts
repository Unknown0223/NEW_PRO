import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikEntitlement
} from "../staff/skladchik-access.prehandler";
import {
  createTransfer,
  getTransfers,
  getTransferById,
  getTransferPdfById,
  updateTransfer,
  startTransfer,
  receiveTransfer,
  cancelTransfer
} from "./warehouse-transfers.service";

function replyWarehouseTransferError(reply: FastifyReply, request: FastifyRequest, e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "EMPTY_LINES") {
    void sendApiError(reply, request, 400, "EmptyLines");
    return true;
  }
  if (msg === "BAD_QTY") {
    void sendApiError(reply, request, 400, "BadQty");
    return true;
  }
  if (msg === "BAD_PRODUCT") {
    void sendApiError(reply, request, 400, "BadProduct");
    return true;
  }
  if (msg === "NOT_DRAFT") {
    void sendApiError(reply, request, 400, "NotDraft");
    return true;
  }
  if (msg === "NOT_IN_TRANSIT") {
    void sendApiError(reply, request, 400, "NotInTransit");
    return true;
  }
  if (msg === "NOT_FOUND") {
    void sendApiError(reply, request, 404, "NotFound");
    return true;
  }
  if (msg === "SAME_WAREHOUSE" || msg === "BAD_WAREHOUSE") {
    void sendApiError(reply, request, 400, msg === "SAME_WAREHOUSE" ? "SameWarehouse" : "BadWarehouse");
    return true;
  }
  if (msg.startsWith("INSUFFICIENT_STOCK:")) {
    void sendApiError(reply, request, 400, "InsufficientStock", undefined, { detail: msg });
    return true;
  }
  if (msg === "STOCK_NOT_FOUND") {
    void sendApiError(reply, request, 409, "StockNotFound");
    return true;
  }
  return false;
}

const transferReadRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

export async function registerWarehouseTransferRoutes(app: FastifyInstance) {
  const preRead = [
    jwtAccessVerify,
    requireRolesOrSkladchikEntitlement(transferReadRoles, "transfer_list")
  ];
  const preWrite = [
    jwtAccessVerify,
    requireRolesOrSkladchikEntitlement(transferReadRoles, "transfer_add")
  ];

  app.get("/api/:slug/transfers", { preHandler: preRead }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await getTransfers(request.tenant!.id, {
      status: q.status,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 20,
      source_warehouse_id: q.sourceWarehouseId ? parseInt(q.sourceWarehouseId) : undefined,
      destination_warehouse_id: q.destinationWarehouseId ? parseInt(q.destinationWarehouseId) : undefined,
    });
    return reply.send(data);
  });

  app.get("/api/:slug/transfers/:id", { preHandler: preRead }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    const data = await getTransferById(request.tenant!.id, parseInt(id));
    return reply.send(data);
  });

  app.get("/api/:slug/transfers/:id/pdf", { preHandler: preRead }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    try {
      const data = await getTransferPdfById(request.tenant!.id, parseInt(id));
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${data.filename}"`)
        .send(data.buffer);
    } catch (e) {
      if (replyWarehouseTransferError(reply, request, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/transfers", { preHandler: preWrite }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = request.body as any;
    try {
      const data = await createTransfer(request.tenant!.id, body);
      return reply.status(201).send(data);
    } catch (e) {
      if (replyWarehouseTransferError(reply, request, e)) return;
      throw e;
    }
  });

  app.patch("/api/:slug/transfers/:id", { preHandler: preWrite }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    const body = request.body as any;
    try {
      const data = await updateTransfer(request.tenant!.id, parseInt(id), body);
      return reply.send(data);
    } catch (e) {
      if (replyWarehouseTransferError(reply, request, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/transfers/:id/start", { preHandler: preWrite }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    try {
      await startTransfer(request.tenant!.id, parseInt(id));
      return reply.send({ ok: true });
    } catch (e) {
      if (replyWarehouseTransferError(reply, request, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/transfers/:id/receive", { preHandler: preWrite }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    const body = request.body as any;
    const jwtUser = getAccessUser(request);
    const data = await receiveTransfer(request.tenant!.id, parseInt(id), Number(jwtUser.sub), body.adjustments || []);
    return reply.send(data);
  });

  app.post("/api/:slug/transfers/:id/cancel", { preHandler: preWrite }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = (request.params as Record<string, string>);
    const data = await cancelTransfer(request.tenant!.id, parseInt(id));
    return reply.send(data);
  });
}
