import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikAnyEntitlement } from "../staff/skladchik-access.prehandler";
import {
  createSupplierPayment,
  deleteSupplierPayment,
  getSupplierReconciliation,
  listSupplierBalancesSummary,
  listSupplierPayments,
  type SupplierPaymentSortKey
} from "./supplier-accounting.service";
import {
  createSupplierRow,
  deleteSupplierRow,
  listSuppliersForTenant,
  restoreSupplierRow,
  updateSupplierRow
} from "./suppliers.service";

const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor", "agent", "expeditor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const supplierReadForReceipt = ["receipt_list", "receipt_add", "receipt_change", "receipt_confirm"] as const;

const createBody = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(64).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional().nullable(),
  opening_balance: z.coerce.number().optional().nullable(),
  opening_balance_note: z.string().max(2000).optional().nullable(),
  /** false — kod bo‘sh bo‘lsa ham avto-generatsiya qilinmasin */
  auto_code: z.boolean().optional()
});

const patchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().max(64).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional().nullable(),
  opening_balance: z.coerce.number().optional().nullable(),
  opening_balance_note: z.string().max(2000).optional().nullable()
});

const paymentCreateBody = z.object({
  supplier_id: z.number().int().positive(),
  cash_desk_id: z.number().int().positive(),
  amount: z.coerce.number().positive(),
  paid_at: z.string().max(40).optional().nullable(),
  payment_method: z.string().max(128).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  idempotency_key: z.string().max(64).optional().nullable()
});

function parseOptPositiveInt(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseDayStartUtc(raw: string | undefined): Date | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function parseDayEndUtc(raw: string | undefined): Date | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const d = new Date(`${t}T23:59:59.999Z`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export async function registerSupplierPaymentRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/suppliers/accounting/reconciliation",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const supplierId = parseOptPositiveInt(q.supplier_id);
      if (supplierId == null) return sendApiError(reply, request, 400, "SupplierIdRequired");
      const dateFrom = q.date_from?.trim() || q.from?.trim() || undefined;
      const dateTo = q.date_to?.trim() || q.to?.trim() || undefined;
      const paymentMethod = q.payment_method?.trim() || undefined;
      try {
        const data = await getSupplierReconciliation(request.tenant!.id, supplierId, {
          date_from: dateFrom,
          date_to: dateTo,
          payment_method: paymentMethod ?? null
        });
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/suppliers",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, supplierReadForReceipt)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const search = q.search?.trim() || undefined;
      const page = parseOptPositiveInt(q.page);
      const limit = parseOptPositiveInt(q.limit);

      let mode: "active" | "inactive" | "all" = "active";
      if (q.all === "true" || q.all === "1") mode = "all";
      else if (q.status === "inactive") mode = "inactive";
      else if (q.status === "active") mode = "active";

      const sortRaw = q.sort_by?.trim();
      const SUP_SORT = new Set(["sort_order", "name", "code", "phone", "opening_balance", "created_at"]);
      const sort_by =
        sortRaw && SUP_SORT.has(sortRaw) ? (sortRaw as "sort_order" | "name" | "code" | "phone" | "opening_balance" | "created_at") : undefined;
      const sort_dir = q.sort_dir === "desc" ? "desc" : "asc";

      const { data, total } = await listSuppliersForTenant(request.tenant!.id, {
        mode,
        search,
        page: page ?? 0,
        limit: limit ?? 0,
        sort_by,
        sort_dir
      });
      return reply.send({ data, total });
    }
  );

  app.post(
    "/api/:slug/suppliers",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createSupplierRow(request.tenant!.id, {
          ...parsed.data,
          auto_code: parsed.data.auto_code !== false
        });
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(row.id),
          action: "supplier.create",
          payload: { name: row.name, code: row.code }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_NAME") return sendApiError(reply, request, 400, "BadName");
        if (msg === "DUPLICATE_CODE") return sendApiError(reply, request, 409, "DuplicateCode");
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return sendApiError(reply, request, 409, "DuplicateCode");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/suppliers/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) return sendApiError(reply, request, 400, "BadId");
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (Object.keys(parsed.data).length === 0) {
        return sendApiError(reply, request, 400, "EmptyBody");
      }
      try {
        const row = await updateSupplierRow(request.tenant!.id, id, parsed.data);
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(id),
          action: "supplier.update",
          payload: parsed.data
        });
        return reply.send({ data: row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_NAME") return sendApiError(reply, request, 400, "BadName");
        if (msg === "DUPLICATE_CODE") return sendApiError(reply, request, 409, "DuplicateCode");
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return sendApiError(reply, request, 409, "DuplicateCode");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/suppliers/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) return sendApiError(reply, request, 400, "BadId");
      try {
        const row = await deleteSupplierRow(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(id),
          action: "supplier.void",
          payload: { name: row.name, soft: true }
        });
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/suppliers/:id/restore",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) return sendApiError(reply, request, 400, "BadId");
      try {
        const row = await restoreSupplierRow(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(id),
          action: "supplier.restore",
          payload: { name: row.name }
        });
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        throw e;
      }
    }
  );
}
