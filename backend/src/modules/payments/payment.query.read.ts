/**
 * Domain: Payments (kirim/chiqim, allocatsiya, batch).
 * Boundary: route → Zod + RBAC; servis → tranzaksiya, client audit, dashboard invalidatsiya.
 * Bog‘liq: `payments.route.ts`, `contracts/payments.schemas.ts`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { invalidateDashboard } from "../../lib/redis-cache";
import {
  allocatePayment,
  getPaymentAllocations,
  type AllocationMode,
  type PaymentAllocationRow
} from "./payment-allocations.service";
import type { PaymentDetailPayload, PaymentListQuery, PaymentListRow } from "./payment.query.types";
import {
  buildPaymentListWhere,
  mapPaymentToListRow,
  paymentListInclude
} from "./payment.query.mappers";

export async function getPaymentDetail(
  tenantId: number,
  paymentId: number
): Promise<PaymentDetailPayload | null> {
  const p = await prisma.payment.findFirst({
    where: { id: paymentId, tenant_id: tenantId },
    include: {
      ...paymentListInclude(tenantId),
      created_by: { select: { name: true } }
    }
  });
  if (!p) return null;

  const allocations = await getPaymentAllocations(tenantId, paymentId);
  const allocatedSum = allocations.reduce(
    (acc, row) => acc.add(new Prisma.Decimal(row.amount)),
    new Prisma.Decimal(0)
  );
  const rawUnalloc = p.amount.sub(allocatedSum);
  const unallocated = rawUnalloc.lt(0) ? new Prisma.Decimal(0) : rawUnalloc;

  const base = mapPaymentToListRow(p, tenantId);
  return {
    payment: {
      ...base,
      created_by_user_id: p.created_by_user_id,
      created_by_name: p.created_by?.name ?? null,
      deleted_by_name: p.deleted_by?.name ?? null
    },
    allocations,
    allocated_total: allocatedSum.toString(),
    unallocated: unallocated.toString()
  };
}

function buildPaymentListOrderBy(q: PaymentListQuery): Prisma.PaymentOrderByWithRelationInput[] {
  const tie: Prisma.PaymentOrderByWithRelationInput = { id: "asc" };
  const dir: Prisma.SortOrder = q.sort_dir === "asc" ? "asc" : "desc";
  const key = q.sort_by;
  if (!key) {
    return [{ created_at: "desc" }, tie];
  }
  switch (key) {
    case "payment_id":
      return [{ id: dir }, tie];
    case "paid_at":
      return [{ paid_at: dir }, tie];
    case "created_at":
      return [{ created_at: dir }, tie];
    case "confirmed_at":
      return [{ confirmed_at: dir }, tie];
    case "last_change":
      return [{ confirmed_at: dir }, { created_at: dir }, tie];
    case "amount":
      return [{ amount: dir }, tie];
    case "payment_type":
      return [{ payment_type: dir }, tie];
    case "note":
      return [{ note: dir }, tie];
    case "client_name":
      return [{ client: { name: dir } }, tie];
    case "order_id":
      return [{ order: { number: dir } }, tie];
    case "agent":
      return [{ client: { agent: { name: dir } } }, tie];
    case "trade_direction":
      return [{ client: { agent: { trade_direction: dir } } }, tie];
    case "consignment":
      return [{ client: { agent: { consignment: dir } } }, tie];
    case "expeditor":
      return [{ expeditor_user: { name: dir } }, tie];
    case "territory":
      return [{ client: { region: dir } }, tie];
    case "changed_by":
      return [{ deleted_by: { name: dir } }, tie];
    default:
      return [{ created_at: "desc" }, tie];
  }
}

export async function listPayments(
  tenantId: number,
  q: PaymentListQuery
): Promise<{ data: PaymentListRow[]; total: number; page: number; limit: number }> {
  const where = buildPaymentListWhere(tenantId, q);
  const inc = paymentListInclude(tenantId);
  const orderBy = buildPaymentListOrderBy(q);

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: inc
    })
  ]);

  return {
    total,
    page: q.page,
    limit: q.limit,
    data: rows.map((r) => mapPaymentToListRow(r, tenantId))
  };
}

export async function listPaymentsForOrder(tenantId: number, orderId: number): Promise<PaymentListRow[]> {
  const inc = paymentListInclude(tenantId);
  const rows = await prisma.payment.findMany({
    where: { tenant_id: tenantId, order_id: orderId, deleted_at: null },
    orderBy: { created_at: "desc" },
    include: inc
  });
  return rows.map((r) => mapPaymentToListRow(r, tenantId));
}

export async function listPaymentsForClient(tenantId: number, clientId: number, limit = 50): Promise<PaymentListRow[]> {
  const inc = paymentListInclude(tenantId);
  const rows = await prisma.payment.findMany({
    where: { tenant_id: tenantId, client_id: clientId, deleted_at: null },
    orderBy: { created_at: "desc" },
    take: limit,
    include: inc
  });
  return rows.map((r) => mapPaymentToListRow(r, tenantId));
}

export type CreatePaymentInput = {
  client_id: number;
  order_id?: number | null;
  amount: number;
  payment_type: string;
  note?: string | null;
  cash_desk_id?: number | null;
  /** ISO 8601; bo‘lmasa — hozirgi vaqt */
  paid_at?: string | null;
  entry_kind?: "payment" | "client_expense" | "discount_settlement";
  /** «Расход клиента» — zakazsiz ekskpeditor */
  expeditor_user_id?: number | null;
  /** Vedoma: `COALESCE(ledger_agent_id, zakaz.agent, mijoz.agent)` */
  ledger_agent_id?: number | null;
  /** cash | consignment | none */
  allocation_mode?: AllocationMode;
  /** Qo‘lda tanlangan zakazlar */
  allocation_order_ids?: number[];
  /** Agent+klient kombinatsiyasi bo‘yicha tanlangan agent */
  allocation_agent_id?: number | null;
};

export async function resolveLedgerAgentId(
  tenantId: number,
  raw: number | null | undefined,
  tx?: Prisma.TransactionClient
): Promise<number | null> {
  if (raw == null || !Number.isFinite(raw) || raw < 1) return null;
  const db = tx ?? prisma;
  const u = await db.user.findFirst({
    where: { id: raw, tenant_id: tenantId, is_active: true }
  });
  if (!u) throw new Error("BAD_LEDGER_AGENT");
  return u.id;
}

