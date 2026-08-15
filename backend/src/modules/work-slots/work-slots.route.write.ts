import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  assignUserBodySchema,
  bulkWorkSlotsBodySchema,
  createWorkSlotBodySchema,
  patchLockBodySchema,
  patchWorkSlotBodySchema,
  resolvePendingBodySchema,
  slotTypeSchema
} from "./work-slots.schema";
import {
  assignUserToSlot,
  bulkPatchWorkSlots,
  countPendingReviews,
  createWorkSlot,
  getAssignChecklist,
  getSlotHistory,
  getWorkSlotDetail,
  listPendingAssignments,
  listWorkSlots,
  patchAssignmentLock,
  patchWorkSlot,
  resolvePendingAssignment,
  restoreWorkSlots,
  suggestNextSlotCode,
  unassignUserFromSlot,
  getWorkSlotActivityReport
} from "./work-slots.service";
import { buildWorkSlotsExportBuffer, importWorkSlotsFromBuffer } from "./work-slots-io.service";

async function readWorkSlotsImportBuffer(
  request: FastifyRequest
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: "NoFile" | "EmptyFile" }> {
  const file = await request.file();
  if (!file) return { ok: false, error: "NoFile" };
  const buf = await file.toBuffer();
  if (buf.length === 0) return { ok: false, error: "EmptyFile" };
  return { ok: true, buf };
}

const manageRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const readRoles = [...manageRoles, "agent", "expeditor"] as const;

const idParams = z.object({ id: z.coerce.number().int().positive() });
const assignmentIdParams = z.object({ id: z.coerce.number().int().positive() });

function mapAssignError(reply: Parameters<typeof sendApiError>[0], request: Parameters<typeof sendApiError>[1], e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
  if (msg === "CODE_TAKEN") return sendApiError(reply, request, 409, "CodeTaken");
  if (
    msg === "BAD_USER" ||
    msg === "BAD_SLOT_TYPE" ||
    msg === "BAD_DIRECTION" ||
    msg === "BAD_WAREHOUSE" ||
    msg === "BAD_CASH_DESK" ||
    msg === "NO_ACTIVE_USER" ||
    msg === "CASH_DESK_ROLE_UNSUPPORTED"
  ) {
    return sendApiError(reply, request, 400, "ValidationError", msg);
  }
  if (msg === "SLOT_INACTIVE" || msg === "NO_ACTIVE_USER") {
    return sendApiError(reply, request, 409, "Conflict", msg);
  }
  if (msg === "LOCK_REASON_REQUIRED") {
    return sendApiError(reply, request, 400, "LockReasonRequired");
  }
  throw e;
}

export async function registerWorkSlotDetailRoutes(app: FastifyInstance) {
  const preRead = [jwtAccessVerify, requireRoles(...readRoles)];
  const preManage = [jwtAccessVerify, requireRoles(...manageRoles)];

  app.get("/api/:slug/work-slots/:id", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    const row = await getWorkSlotDetail(request.tenant!.id, p.data.id);
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    return reply.send({ data: row });
  });

  app.patch("/api/:slug/work-slots/:id", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = patchWorkSlotBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const row = await patchWorkSlot(
        request.tenant!.id,
        p.data.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.post("/api/:slug/work-slots/:id/assign", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = assignUserBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      await assignUserToSlot(
        request.tenant!.id,
        p.data.id,
        parsed.data.user_id,
        actorUserIdOrNull(request),
        parsed.data.note
      );
      const row = await getWorkSlotDetail(request.tenant!.id, p.data.id);
      return reply.send({ data: row });
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.post("/api/:slug/work-slots/:id/unassign", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    const body = (request.body ?? {}) as { note?: string };
    try {
      await unassignUserFromSlot(request.tenant!.id, p.data.id, actorUserIdOrNull(request), body.note);
      const row = await getWorkSlotDetail(request.tenant!.id, p.data.id);
      return reply.send({ data: row });
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.get("/api/:slug/work-slots/:id/history", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    const q = request.query as Record<string, string | undefined>;
    try {
      const data = await getSlotHistory(
        request.tenant!.id,
        p.data.id,
        q.page ? parseInt(q.page, 10) : 1,
        q.limit ? parseInt(q.limit, 10) : 50
      );
      return reply.send(data);
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.get("/api/:slug/work-slots/:id/checklist", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    try {
      const data = await getAssignChecklist(request.tenant!.id, p.data.id);
      return reply.send({ data });
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.get("/api/:slug/client-agent-assignments/pending", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await listPendingAssignments(
      request.tenant!.id,
      q.page ? parseInt(q.page, 10) : 1,
      q.limit ? parseInt(q.limit, 10) : 50
    );
    return reply.send(data);
  });

  app.patch(
    "/api/:slug/client-agent-assignments/:id/lock",
    { preHandler: preManage },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = assignmentIdParams.safeParse(request.params);
      if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
      const parsed = patchLockBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchAssignmentLock(
          request.tenant!.id,
          p.data.id,
          parsed.data.lock_type,
          parsed.data.lock_reason ?? null,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: row });
      } catch (e) {
        return mapAssignError(reply, request, e);
      }
    }
  );

  app.get("/api/:slug/work-slots/export.xlsx", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const buf = await buildWorkSlotsExportBuffer(request.tenant!.id);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", 'attachment; filename="work-slots.xlsx"');
    return reply.send(buf);
  });

  app.post("/api/:slug/work-slots/import.xlsx", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const read = await readWorkSlotsImportBuffer(request);
    if (!read.ok) {
      if (read.error === "NoFile") return sendApiError(reply, request, 400, "NoFile");
      return sendApiError(reply, request, 400, "EmptyFile");
    }
    try {
      const result = await importWorkSlotsFromBuffer(
        request.tenant!.id,
        read.buf,
        actorUserIdOrNull(request)
      );
      return reply.send({ data: result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "EMPTY_FILE") return sendApiError(reply, request, 400, "EmptyFile");
      if (msg === "TOO_MANY_ROWS") return sendApiError(reply, request, 400, "TooManyRows");
      throw e;
    }
  });

  app.post(
    "/api/:slug/client-agent-assignments/:id/resolve",
    { preHandler: preManage },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = assignmentIdParams.safeParse(request.params);
      if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
      const parsed = resolvePendingBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await resolvePendingAssignment(
          request.tenant!.id,
          p.data.id,
          parsed.data.agent_id,
          parsed.data.lock_after === true,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: row });
      } catch (e) {
        return mapAssignError(reply, request, e);
      }
    }
  );
}
