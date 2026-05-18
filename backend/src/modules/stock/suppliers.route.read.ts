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

export async function registerSupplierCrudRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/suppliers/accounting/balances",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as { search?: string };
      const data = await listSupplierBalancesSummary(request.tenant!.id, q.search);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/suppliers/accounting/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const supplier_id = parseOptPositiveInt(q.supplier_id);
      const cash_desk_id = parseOptPositiveInt(q.cash_desk_id);
      const page = parseOptPositiveInt(q.page) ?? 1;
      const limit = Math.min(100, parseOptPositiveInt(q.limit) ?? 20);
      const payment_method = q.payment_method?.trim() || undefined;
      const paid_from = parseDayStartUtc(q.from ?? q.date_from);
      const paid_to = parseDayEndUtc(q.to ?? q.date_to);
      const amount_from =
        q.amount_from != null && q.amount_from.trim() !== ""
          ? Number.parseFloat(q.amount_from.replace(",", "."))
          : undefined;
      const amount_to =
        q.amount_to != null && q.amount_to.trim() !== ""
          ? Number.parseFloat(q.amount_to.replace(",", "."))
          : undefined;
      const include_reversed = q.include_reversed === "1" || q.include_reversed === "true";
      const sort_dir = q.sort_dir === "asc" ? "asc" : "desc";
      const PAYMENT_SORT_KEYS = new Set<string>([
        "created_at",
        "paid_at",
        "amount",
        "supplier_name",
        "payment_method",
        "cash_desk_name",
        "created_by_name",
        "id"
      ]);
      const sortRaw = q.sort_by?.trim();
      const sort_by: SupplierPaymentSortKey | undefined =
        sortRaw && PAYMENT_SORT_KEYS.has(sortRaw) ? (sortRaw as SupplierPaymentSortKey) : undefined;
      const search = q.search?.trim() || undefined;
      const af = amount_from != null && Number.isFinite(amount_from) ? amount_from : undefined;
      const at = amount_to != null && Number.isFinite(amount_to) ? amount_to : undefined;
      const result = await listSupplierPayments(request.tenant!.id, {
        supplier_id,
        cash_desk_id,
        payment_method: payment_method ?? null,
        paid_from,
        paid_to,
        amount_from: af,
        amount_to: at,
        include_reversed,
        sort_dir,
        sort_by,
        search: search ?? null,
        page,
        limit
      });
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/suppliers/accounting/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = paymentCreateBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        let paidAt: Date | undefined;
        if (parsed.data.paid_at?.trim()) {
          const d = new Date(parsed.data.paid_at.trim());
          if (!Number.isFinite(d.getTime())) return sendApiError(reply, request, 400, "BadDate");
          paidAt = d;
        }
        const row = await createSupplierPayment(request.tenant!.id, actorUserIdOrNull(request), {
          supplier_id: parsed.data.supplier_id,
          cash_desk_id: parsed.data.cash_desk_id,
          amount: parsed.data.amount,
          paid_at: paidAt,
          payment_method: parsed.data.payment_method,
          comment: parsed.data.comment,
          idempotency_key: parsed.data.idempotency_key
        });
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(parsed.data.supplier_id),
          action: "supplier_payment.create",
          payload: { payment_id: row.id, amount: row.amount }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_SUPPLIER") return sendApiError(reply, request, 400, "BadSupplier");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
        if (msg === "INSUFFICIENT_CASH") return sendApiError(reply, request, 409, "InsufficientCash");
        if (msg === "DUPLICATE_IDEMPOTENCY") return sendApiError(reply, request, 409, "DuplicateIdempotency");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/suppliers/accounting/payments/:paymentId",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const paymentId = Number.parseInt((request.params as { paymentId: string }).paymentId, 10);
      if (!Number.isFinite(paymentId) || paymentId <= 0) return sendApiError(reply, request, 400, "BadId");
      try {
        await deleteSupplierPayment(request.tenant!.id, paymentId, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.supplier,
          entityId: String(paymentId),
          action: "supplier_payment.reverse",
          payload: {}
        });
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_REVERSED") return sendApiError(reply, request, 409, "AlreadyReversed");
        throw e;
      }
    }
  );
}
