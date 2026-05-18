import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";
import type { ListSupplierPaymentsOpts } from "./supplier-accounting.types";
import {
  buildSupplierPaymentOrderBy,
  buildSupplierPaymentWhere,
  decimalStr
} from "./supplier-accounting.shared";

export async function listSupplierPayments(tenantId: number, opts: ListSupplierPaymentsOpts) {
  const where = buildSupplierPaymentWhere(tenantId, opts);
  const dir = opts.sort_dir === "asc" ? "asc" : "desc";
  const orderBy = buildSupplierPaymentOrderBy(opts.sort_by, dir);

  const [rows, total] = await Promise.all([
    prisma.supplierPayment.findMany({
      where,
      orderBy,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        cash_desk: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } }
      }
    }),
    prisma.supplierPayment.count({ where })
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier.name,
      supplier_code: r.supplier.code,
      amount: decimalStr(r.amount),
      paid_at: r.paid_at.toISOString(),
      created_at: r.created_at.toISOString(),
      payment_method: r.payment_method,
      cash_desk_id: r.cash_desk_id,
      cash_desk_name: r.cash_desk?.name ?? null,
      comment: r.comment,
      created_by_user_id: r.created_by_user_id,
      created_by_name: r.created_by?.name ?? null,
      reversed_at: r.reversed_at?.toISOString() ?? null
    })),
    total
  };
}

export async function createSupplierPayment(
  tenantId: number,
  actorUserId: number | null,
  input: {
    supplier_id: number;
    cash_desk_id: number;
    amount: number;
    paid_at?: Date;
    payment_method?: string | null;
    comment?: string | null;
    idempotency_key?: string | null;
  }
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("BAD_AMOUNT");
  if (!Number.isFinite(input.cash_desk_id) || input.cash_desk_id <= 0) throw new Error("BAD_CASH_DESK");

  const sup = await prisma.supplier.findFirst({
    where: { id: input.supplier_id, tenant_id: tenantId, is_active: true },
    select: { id: true }
  });
  if (!sup) throw new Error("BAD_SUPPLIER");

  const desk = await prisma.cashDesk.findFirst({
    where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true },
    select: { id: true }
  });
  if (!desk) throw new Error("BAD_CASH_DESK");

  const idem = input.idempotency_key?.trim() || null;
  if (idem) {
    const dup = await prisma.supplierPayment.findFirst({
      where: { tenant_id: tenantId, idempotency_key: idem, reversed_at: null },
      select: { id: true }
    });
    if (dup) throw new Error("DUPLICATE_IDEMPOTENCY");
  }

  const amountDec = new Decimal(input.amount);

  const row = await prisma.$transaction(async (tx) => {
    const available = await getCashDeskAvailableCash(tx, tenantId, input.cash_desk_id);
    if (available.lt(amountDec)) throw new Error("INSUFFICIENT_CASH");

    return tx.supplierPayment.create({
      data: {
        tenant_id: tenantId,
        supplier_id: input.supplier_id,
        cash_desk_id: input.cash_desk_id,
        amount: amountDec,
        paid_at: input.paid_at ?? new Date(),
        payment_method: input.payment_method?.trim() || null,
        comment: input.comment?.trim() || null,
        created_by_user_id: actorUserId ?? undefined,
        idempotency_key: idem
      },
      include: {
        supplier: { select: { name: true, code: true } },
        cash_desk: { select: { name: true } },
        created_by: { select: { name: true } }
      }
    });
  });

  return {
    id: row.id,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier.name,
    amount: decimalStr(row.amount),
    paid_at: row.paid_at.toISOString(),
    created_at: row.created_at.toISOString(),
    payment_method: row.payment_method,
    cash_desk_id: row.cash_desk_id,
    cash_desk_name: row.cash_desk?.name ?? null,
    comment: row.comment,
    created_by_name: row.created_by?.name ?? null
  };
}

export async function reverseSupplierPayment(tenantId: number, paymentId: number, actorUserId: number | null) {
  const uid = actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  await prisma.$transaction(async (tx) => {
    const row = await tx.supplierPayment.findFirst({
      where: { id: paymentId, tenant_id: tenantId },
      select: { id: true, reversed_at: true }
    });
    if (!row) throw new Error("NOT_FOUND");
    if (row.reversed_at != null) throw new Error("ALREADY_REVERSED");

    await tx.supplierPayment.update({
      where: { id: paymentId },
      data: {
        reversed_at: new Date(),
        reversed_by_user_id: uid
      }
    });
  });
}

/** Storno (hard delete yo‘q) */
export async function deleteSupplierPayment(tenantId: number, paymentId: number, actorUserId: number | null) {
  await reverseSupplierPayment(tenantId, paymentId, actorUserId);
}
