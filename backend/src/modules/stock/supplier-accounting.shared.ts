import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";

import type { ListSupplierPaymentsOpts, SupplierPaymentSortKey } from "./supplier-accounting.types";

export function decimalStr(v: Decimal | null | undefined): string {
  return (v ?? new Decimal(0)).toDecimalPlaces(2).toString();
}

export function buildSupplierPaymentOrderBy(
  sortBy: SupplierPaymentSortKey | undefined,
  dir: "asc" | "desc"
): Prisma.SupplierPaymentOrderByWithRelationInput[] {
  const d = dir;
  switch (sortBy) {
    case "paid_at":
      return [{ paid_at: d }, { id: d }];
    case "amount":
      return [{ amount: d }, { id: d }];
    case "supplier_name":
      return [{ supplier: { name: d } }, { id: d }];
    case "payment_method":
      return [{ payment_method: d }, { id: d }];
    case "cash_desk_name":
      return [{ cash_desk: { name: d } }, { id: d }];
    case "created_by_name":
      return [{ created_by: { name: d } }, { id: d }];
    case "id":
      return [{ id: d }];
    case "created_at":
    default:
      return [{ created_at: d }, { id: d }];
  }
}

export function buildSupplierPaymentWhere(tenantId: number, opts: ListSupplierPaymentsOpts): Prisma.SupplierPaymentWhereInput {
  const where: Prisma.SupplierPaymentWhereInput = { tenant_id: tenantId };
  if (!opts.include_reversed) {
    where.reversed_at = null;
  }
  if (opts.supplier_id != null && opts.supplier_id > 0) where.supplier_id = opts.supplier_id;
  if (opts.cash_desk_id != null && opts.cash_desk_id > 0) where.cash_desk_id = opts.cash_desk_id;
  if (opts.payment_method != null && String(opts.payment_method).trim()) {
    where.payment_method = String(opts.payment_method).trim();
  }
  const paidFilter: Prisma.DateTimeFilter = {};
  if (opts.paid_from != null && Number.isFinite(opts.paid_from.getTime())) paidFilter.gte = opts.paid_from;
  if (opts.paid_to != null && Number.isFinite(opts.paid_to.getTime())) paidFilter.lte = opts.paid_to;
  if (Object.keys(paidFilter).length > 0) where.paid_at = paidFilter;

  const amountFilter: Prisma.DecimalFilter = {};
  if (opts.amount_from != null && Number.isFinite(opts.amount_from)) {
    amountFilter.gte = new Decimal(opts.amount_from);
  }
  if (opts.amount_to != null && Number.isFinite(opts.amount_to)) {
    amountFilter.lte = new Decimal(opts.amount_to);
  }
  if (Object.keys(amountFilter).length > 0) where.amount = amountFilter;

  const s = opts.search?.trim();
  if (s) {
    const idNum = Number.parseInt(s, 10);
    const or: Prisma.SupplierPaymentWhereInput[] = [
      { supplier: { name: { contains: s, mode: "insensitive" } } },
      { comment: { contains: s, mode: "insensitive" } },
    ];
    if (Number.isFinite(idNum) && idNum > 0) or.push({ id: idNum });
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: or }];
  }

  return where;
}
