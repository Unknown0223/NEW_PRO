import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";

import { decimalStr } from "./supplier-accounting.shared";

export async function getSupplierReconciliation(
  tenantId: number,
  supplierId: number,
  opts: { date_from?: string; date_to?: string; payment_method?: string | null }
) {
  const sup = await prisma.supplier.findFirst({
    where: { id: supplierId, tenant_id: tenantId },
    select: { id: true, name: true, code: true, opening_balance: true, opening_balance_note: true }
  });
  if (!sup) throw new Error("NOT_FOUND");

  const openingGlobal = new Decimal(sup.opening_balance ?? 0);
  const df = opts.date_from?.trim();
  const dt = opts.date_to?.trim();
  const pm = opts.payment_method?.trim() || null;

  const startUtc = df ? new Date(`${df}T00:00:00.000Z`) : null;
  const endUtc = dt ? new Date(`${dt}T23:59:59.999Z`) : null;

  const receiptBase: Prisma.GoodsReceiptWhereInput = {
    tenant_id: tenantId,
    supplier_id: supplierId,
    deleted_at: null,
    status: "posted"
  };

  const receiptBeforeWhere: Prisma.GoodsReceiptWhereInput = { ...receiptBase };
  if (startUtc) receiptBeforeWhere.created_at = { lt: startUtc };

  const payBeforeWhere: Prisma.SupplierPaymentWhereInput = {
    tenant_id: tenantId,
    supplier_id: supplierId,
    reversed_at: null
  };
  if (startUtc) payBeforeWhere.paid_at = { lt: startUtc };

  const [recvBeforeAgg, payBeforeAgg] = await Promise.all([
    prisma.goodsReceipt.aggregate({
      where: receiptBeforeWhere,
      _sum: { total_sum: true }
    }),
    prisma.supplierPayment.aggregate({
      where: payBeforeWhere,
      _sum: { amount: true }
    })
  ]);
  const sumRecvBefore = recvBeforeAgg._sum?.total_sum ?? new Decimal(0);
  const sumPayBefore = payBeforeAgg._sum?.amount ?? new Decimal(0);
  const balanceStart = openingGlobal.add(sumRecvBefore).sub(sumPayBefore);

  const receiptInWhere: Prisma.GoodsReceiptWhereInput = { ...receiptBase };
  if (startUtc || endUtc) {
    receiptInWhere.created_at = {};
    if (startUtc) receiptInWhere.created_at.gte = startUtc;
    if (endUtc) receiptInWhere.created_at.lte = endUtc;
  }

  const payInWhere: Prisma.SupplierPaymentWhereInput = {
    tenant_id: tenantId,
    supplier_id: supplierId,
    reversed_at: null
  };
  if (pm) payInWhere.payment_method = pm;
  if (startUtc || endUtc) {
    payInWhere.paid_at = {};
    if (startUtc) payInWhere.paid_at.gte = startUtc;
    if (endUtc) payInWhere.paid_at.lte = endUtc;
  }

  const [receipts, payments] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where: receiptInWhere,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: { id: true, number: true, total_sum: true, created_at: true, comment: true }
    }),
    prisma.supplierPayment.findMany({
      where: payInWhere,
      orderBy: [{ paid_at: "asc" }, { id: "asc" }],
      select: { id: true, amount: true, paid_at: true, comment: true, payment_method: true }
    })
  ]);

  type Ev = {
    t: Date;
    kind: "receipt" | "payment";
    type_label: string;
    payment_method: string | null;
    label: string;
    comment: string | null;
    debit: Decimal;
    credit: Decimal;
    ref: string;
  };
  const ev: Ev[] = [];
  for (const r of receipts) {
    ev.push({
      t: r.created_at,
      kind: "receipt",
      type_label: "Полученный продукт поставщика",
      payment_method: null,
      label: `Приход №${r.number}`,
      comment: r.comment?.trim() || null,
      debit: r.total_sum,
      credit: new Decimal(0),
      ref: String(r.id)
    });
  }
  for (const p of payments) {
    ev.push({
      t: p.paid_at,
      kind: "payment",
      type_label: "Оплата поставщику",
      payment_method: p.payment_method?.trim() || null,
      label: `Оплата №${p.id}`,
      comment: p.comment?.trim() || null,
      debit: new Decimal(0),
      credit: p.amount,
      ref: String(p.id)
    });
  }
  ev.sort((a, b) => a.t.getTime() - b.t.getTime() || a.ref.localeCompare(b.ref));

  const purchasesTotal = receipts.reduce((s, r) => s.add(r.total_sum), new Decimal(0));
  const paymentsTotal = payments.reduce((s, p) => s.add(p.amount), new Decimal(0));
  const closing = balanceStart.add(purchasesTotal).sub(paymentsTotal);

  const lines: {
    date: string;
    kind: string;
    type_label: string;
    label: string;
    ref: string;
    payment_method: string | null;
    comment: string | null;
    debit: string;
    credit: string;
    balance: string;
  }[] = [];

  const odOpen = balanceStart.gt(0) ? balanceStart : new Decimal(0);
  const ocOpen = balanceStart.lt(0) ? balanceStart.abs() : new Decimal(0);
  lines.push({
    date: "",
    kind: "period_opening",
    type_label: "Остаток на начало периода",
    label: "",
    ref: "",
    payment_method: null,
    comment: null,
    debit: decimalStr(odOpen),
    credit: decimalStr(ocOpen),
    balance: decimalStr(balanceStart)
  });

  let running = balanceStart;
  let sumDebitMove = new Decimal(0);
  let sumCreditMove = new Decimal(0);
  for (const e of ev) {
    running = running.add(e.debit).sub(e.credit);
    sumDebitMove = sumDebitMove.add(e.debit);
    sumCreditMove = sumCreditMove.add(e.credit);
    lines.push({
      date: e.t.toISOString(),
      kind: e.kind,
      type_label: e.type_label,
      label: e.label,
      ref: e.ref,
      payment_method: e.payment_method,
      comment: e.comment,
      debit: decimalStr(e.debit),
      credit: decimalStr(e.credit),
      balance: decimalStr(running)
    });
  }

  lines.push({
    date: "",
    kind: "turnover",
    type_label: "Обороты",
    label: "",
    ref: "",
    payment_method: null,
    comment: null,
    debit: decimalStr(sumDebitMove),
    credit: decimalStr(sumCreditMove),
    balance: decimalStr(running)
  });
  lines.push({
    date: "",
    kind: "total",
    type_label: "Итог",
    label: "",
    ref: "",
    payment_method: null,
    comment: null,
    debit: decimalStr(sumDebitMove),
    credit: decimalStr(sumCreditMove),
    balance: decimalStr(closing)
  });

  return {
    supplier: { id: sup.id, name: sup.name, code: sup.code, opening_balance_note: sup.opening_balance_note },
    /** Остаток на начало выбранного периода (учёт: нач. баланс справочника + приходы − оплаты до периода) */
    opening_balance: decimalStr(balanceStart),
    /** Начальный баланс из карточки поставщика (справочно) */
    supplier_opening_balance: decimalStr(openingGlobal),
    purchases_total: decimalStr(purchasesTotal),
    payments_total: decimalStr(paymentsTotal),
    closing_balance: decimalStr(closing),
    lines
  };
}
