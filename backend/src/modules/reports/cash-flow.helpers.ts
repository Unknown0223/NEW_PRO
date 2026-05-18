import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { CashFlowMoney, CashFlowTableChild } from "./cash-flow.types";
import type { Split } from "./cash-flow.types";
import { ZERO } from "./cash-flow.types";

export function decStr(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

export function splitTotal(s: Split): CashFlowMoney {
  const total = s.terminal.add(s.cash);
  return { terminal: decStr(s.terminal), cash: decStr(s.cash), total: decStr(total) };
}

export function add(a: Split, b: Split): Split {
  return { terminal: a.terminal.add(b.terminal), cash: a.cash.add(b.cash) };
}

export function sub(a: Split, b: Split): Split {
  return { terminal: a.terminal.sub(b.terminal), cash: a.cash.sub(b.cash) };
}

export function parseDayStartUtc(isoDate: string): Date {
  const d = new Date(`${isoDate.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("BAD_DATE_FROM");
  return d;
}

export function parseDayEndUtc(isoDate: string): Date {
  const d = new Date(`${isoDate.trim()}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) throw new Error("BAD_DATE_TO");
  return d;
}

/** Terminal / Naqd — spravochnik `code`/`name` bo‘yicha; qolganlari Naqd (naqt pul) deb */
export function channelForMethod(m: PaymentMethodEntryDto): "terminal" | "cash" {
  const c = (m.code ?? "").toLowerCase();
  const n = m.name.toLowerCase();
  if (
    c.includes("terminal") ||
    n.includes("terminal") ||
    c.includes("perechis") ||
    n.includes("perechis") ||
    c.includes("перечис") ||
    n.includes("перечис")
  ) {
    return "terminal";
  }
  if (c.includes("naqd") || n.includes("naqd") || c === "cash" || n.includes("cash")) {
    return "cash";
  }
  return "cash";
}

export function resolveMethodForPaymentType(
  raw: string,
  methods: PaymentMethodEntryDto[]
): PaymentMethodEntryDto | null {
  const r = raw.trim();
  if (!r) return null;
  const active = methods.filter((e) => e.active !== false);
  const byId = active.find((e) => e.id === r) ?? methods.find((e) => e.id === r);
  if (byId) return byId;
  const byKey =
    active.find((e) => paymentMethodStorageKey(e) === r) ??
    methods.find((e) => paymentMethodStorageKey(e) === r);
  if (byKey) return byKey;
  const rl = r.toLowerCase();
  return (
    active.find((e) => e.name.trim().toLowerCase() === rl) ??
    methods.find((e) => e.name.trim().toLowerCase() === rl) ??
    null
  );
}

export function classifyPaymentType(raw: string, methods: PaymentMethodEntryDto[]): "terminal" | "cash" {
  const m = resolveMethodForPaymentType(raw, methods);
  if (m) return channelForMethod(m);
  const rl = raw.toLowerCase();
  if (rl.includes("terminal")) return "terminal";
  if (rl.includes("perechis") || rl.includes("перечис")) return "terminal";
  return "cash";
}

export function applySignedAmount(split: Split, paymentType: string, amount: Prisma.Decimal, methods: PaymentMethodEntryDto[], sign: 1 | -1): Split {
  const ch = classifyPaymentType(paymentType, methods);
  const v = sign === 1 ? amount : amount.neg();
  if (ch === "terminal") {
    return { terminal: split.terminal.add(v), cash: split.cash };
  }
  return { terminal: split.terminal, cash: split.cash.add(v) };
}

import type { AggRow } from "./cash-flow.types";

export async function aggregatePaymentsDesk(
  tenantId: number,
  cashDeskId: number,
  range: "before" | "inside",
  dayStart: Date,
  dayEnd: Date
): Promise<AggRow[]> {
  if (range === "before") {
    const rows = await prisma.$queryRaw<
      Array<{ entry_kind: string; payment_type: string; order_id: number | null; s: unknown }>
    >(Prisma.sql`
      SELECT p.entry_kind::text AS entry_kind,
             p.payment_type::text AS payment_type,
             p.order_id AS order_id,
             SUM(p.amount) AS s
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND p.workflow_status = 'confirmed'
        AND p.cash_desk_id = ${cashDeskId}
        AND COALESCE(p.paid_at, p.confirmed_at, p.created_at) < ${dayStart}
      GROUP BY p.entry_kind, p.payment_type, p.order_id
    `);
    return rows.map((r) => ({
      entry_kind: r.entry_kind,
      payment_type: r.payment_type,
      order_id: r.order_id,
      s: new Prisma.Decimal(String(r.s))
    }));
  }

  const rows = await prisma.$queryRaw<
    Array<{ entry_kind: string; payment_type: string; order_id: number | null; s: unknown }>
  >(Prisma.sql`
    SELECT p.entry_kind::text AS entry_kind,
           p.payment_type::text AS payment_type,
           p.order_id AS order_id,
           SUM(p.amount) AS s
    FROM client_payments p
    WHERE p.tenant_id = ${tenantId}
      AND p.deleted_at IS NULL
      AND p.workflow_status = 'confirmed'
      AND p.cash_desk_id = ${cashDeskId}
      AND COALESCE(p.paid_at, p.confirmed_at, p.created_at) >= ${dayStart}
      AND COALESCE(p.paid_at, p.confirmed_at, p.created_at) <= ${dayEnd}
    GROUP BY p.entry_kind, p.payment_type, p.order_id
  `);
  return rows.map((r) => ({
    entry_kind: r.entry_kind,
    payment_type: r.payment_type,
    order_id: r.order_id,
    s: new Prisma.Decimal(String(r.s))
  }));
}

export async function aggregateExpensesApproved(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date
): Promise<Array<{ expense_type: string; s: Prisma.Decimal }>> {
  const rows = await prisma.$queryRaw<Array<{ expense_type: string; s: unknown }>>(Prisma.sql`
    SELECT e.expense_type::text AS expense_type, SUM(e.amount) AS s
    FROM expenses e
    WHERE e.tenant_id = ${tenantId}
      AND e.deleted_at IS NULL
      AND e.status = 'approved'
      AND e.expense_date >= ${dayStart}
      AND e.expense_date <= ${dayEnd}
    GROUP BY e.expense_type
  `);
  return rows.map((r) => ({
    expense_type: r.expense_type,
    s: new Prisma.Decimal(String(r.s))
  }));
}

/** `before` va `inside` qatorlari alohida — opening faqat < from */
export function foldOpeningOnly(rowsBefore: AggRow[], methods: PaymentMethodEntryDto[]): Split {
  let opening = { ...ZERO };
  for (const r of rowsBefore) {
    const ek = String(r.entry_kind ?? "payment");
    if (ek === "payment") {
      opening = applySignedAmount(opening, r.payment_type, r.s, methods, 1);
    } else if (ek === "client_expense") {
      opening = applySignedAmount(opening, r.payment_type, r.s, methods, -1);
    }
  }
  return opening;
}

export function foldPeriodIncomeExpense(
  rowsInside: AggRow[],
  methods: PaymentMethodEntryDto[]
): { incomePayment: Split; incomeOther: Split; expenseClient: Split } {
  let incomePayment = { ...ZERO };
  let incomeOther = { ...ZERO };
  let expenseClient = { ...ZERO };
  for (const r of rowsInside) {
    const ek = String(r.entry_kind ?? "payment");
    if (ek === "payment") {
      const t = r.order_id != null ? incomePayment : incomeOther;
      const next = applySignedAmount(t, r.payment_type, r.s, methods, 1);
      if (r.order_id != null) incomePayment = next;
      else incomeOther = next;
    } else if (ek === "client_expense") {
      /** Davr ichidagi «расход клиента» — UI va итогда musbat modul */
      expenseClient = applySignedAmount(expenseClient, r.payment_type, r.s, methods, 1);
    }
  }
  return { incomePayment, incomeOther, expenseClient };
}

