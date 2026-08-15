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

export async function registerWorkSlotListRoutes(app: FastifyInstance) {
  const preRead = [jwtAccessVerify, requireRoles(...readRoles)];
  const preManage = [jwtAccessVerify, requireRoles(...manageRoles)];

  app.get("/api/:slug/work-slots/suggest-code", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as { slot_type?: string; branch_code?: string };
    const slotTypeParsed = slotTypeSchema.safeParse(q.slot_type ?? "agent");
    if (!slotTypeParsed.success) {
      return sendApiError(reply, request, 400, "ValidationError");
    }
    const code = await suggestNextSlotCode(
      request.tenant!.id,
      slotTypeParsed.data,
      q.branch_code ?? null
    );
    return reply.send({ data: { slot_code: code } });
  });

  app.get("/api/:slug/work-slots", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const splitCsv = (raw?: string) =>
      raw?.trim()
        ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))]
        : [];
    const splitCsvInts = (raw?: string) =>
      splitCsv(raw)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
    const slotTypes = splitCsv(q.slot_types);
    const branchCodes = splitCsv(q.branch_codes);
    const directionIds = splitCsvInts(q.direction_ids);
    const territoryZones = splitCsv(q.territory_zones);
    const territoryOblasts = splitCsv(q.territory_oblasts);
    const territoryCities = splitCsv(q.territory_cities);
    const warehouseIds = splitCsvInts(q.warehouse_ids);
    const cashDeskIds = splitCsvInts(q.cash_desk_ids);
    const data = await listWorkSlots(request.tenant!.id, {
      branch_code: branchCodes.length === 0 ? q.branch_code : undefined,
      branch_codes: branchCodes.length ? branchCodes : undefined,
      slot_type: q.slot_type,
      slot_types: slotTypes.length ? slotTypes : undefined,
      is_active: q.is_active === "true" ? true : q.is_active === "false" ? false : undefined,
      archive: q.archive === "true" || q.archive === "1",
      q: q.q,
      direction_id:
        directionIds.length === 0 && q.direction_id
          ? Number.parseInt(q.direction_id, 10)
          : undefined,
      direction_ids: directionIds.length ? directionIds : undefined,
      territory: q.territory,
      territory_zone: territoryZones.length === 0 ? q.territory_zone : undefined,
      territory_zones: territoryZones.length ? territoryZones : undefined,
      territory_oblast: territoryOblasts.length === 0 ? q.territory_oblast : undefined,
      territory_oblasts: territoryOblasts.length ? territoryOblasts : undefined,
      territory_city: territoryCities.length === 0 ? q.territory_city : undefined,
      territory_cities: territoryCities.length ? territoryCities : undefined,
      warehouse_id:
        warehouseIds.length === 0 && q.warehouse_id
          ? Number.parseInt(q.warehouse_id, 10)
          : undefined,
      warehouse_ids: warehouseIds.length ? warehouseIds : undefined,
      cash_desk_id:
        cashDeskIds.length === 0 && q.cash_desk_id ? Number.parseInt(q.cash_desk_id, 10) : undefined,
      cash_desk_ids: cashDeskIds.length ? cashDeskIds : undefined,
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 50
    });
    return reply.send(data);
  });

  app.post("/api/:slug/work-slots/bulk", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = bulkWorkSlotsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await bulkPatchWorkSlots(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "EMPTY_IDS" || msg === "EMPTY_PATCH") {
        return sendApiError(reply, request, 400, "ValidationError", msg);
      }
      if (msg === "TOO_MANY") return sendApiError(reply, request, 400, "TooManySlots");
      if (msg === "BAD_SLOT_IDS") return sendApiError(reply, request, 400, "BadSlotIds");
      if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
      if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      throw e;
    }
  });

  app.post("/api/:slug/work-slots/restore", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = request.body as { slot_ids?: number[] };
    const slotIds = Array.isArray(body?.slot_ids) ? body.slot_ids : [];
    try {
      const data = await restoreWorkSlots(request.tenant!.id, slotIds, actorUserIdOrNull(request));
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "ValidationError", msg);
      if (msg === "TOO_MANY") return sendApiError(reply, request, 400, "TooManySlots");
      if (msg === "BAD_SLOT_IDS") return sendApiError(reply, request, 400, "BadSlotIds");
      if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      throw e;
    }
  });

  app.post("/api/:slug/work-slots", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = createWorkSlotBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const row = await createWorkSlot(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.status(201).send({ data: row });
    } catch (e) {
      return mapAssignError(reply, request, e);
    }
  });

  app.get("/api/:slug/work-slots/pending-count", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const count = await countPendingReviews(request.tenant!.id);
    return reply.send({ count });
  });

  app.get("/api/:slug/work-slots/activity-report", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const fromRaw = q.date_from?.trim();
    const toRaw = q.date_to?.trim();
    if (!fromRaw || !toRaw) {
      return sendApiError(reply, request, 400, "ValidationError", "date_from and date_to required");
    }
    const dateFrom = new Date(fromRaw);
    const dateTo = new Date(toRaw);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid date");
    }
    try {
      const data = await getWorkSlotActivityReport(request.tenant!.id, {
        date_from: dateFrom,
        date_to: dateTo,
        branch_code: q.branch_code,
        slot_type: q.slot_type,
        page: q.page ? Number.parseInt(q.page, 10) : 1,
        limit: q.limit ? Number.parseInt(q.limit, 10) : 50
      });
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_DATE_RANGE") {
        return sendApiError(reply, request, 400, "ValidationError", msg);
      }
      throw e;
    }
  });
}
