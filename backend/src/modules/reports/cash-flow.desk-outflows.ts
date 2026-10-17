import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import { applySignedAmount } from "./cash-flow.helpers";
import { ZERO, type Split } from "./cash-flow.types";

type Range = "before" | "inside";

function rangeSql(col: Prisma.Sql, range: Range, dayStart: Date, dayEnd: Date): Prisma.Sql {
  return range === "before"
    ? Prisma.sql`${col} < ${dayStart}`
    : Prisma.sql`${col} >= ${dayStart} AND ${col} <= ${dayEnd}`;
}

/** Kassaga bog'langan tasdiqlangan xarajatlar (turi bo'yicha). */
export async function aggregateDeskExpenses(
  tenantId: number,
  cashDeskId: number,
  range: Range,
  dayStart: Date,
  dayEnd: Date
): Promise<Array<{ expense_type: string; s: Prisma.Decimal }>> {
  const rows = await prisma.$queryRaw<Array<{ expense_type: string; s: unknown }>>(Prisma.sql`
    SELECT e.expense_type::text AS expense_type, SUM(e.amount) AS s
    FROM expenses e
    WHERE e.tenant_id = ${tenantId}
      AND e.cash_desk_id = ${cashDeskId}
      AND e.deleted_at IS NULL
      AND e.status = 'approved'
      AND ${rangeSql(Prisma.sql`e.expense_date`, range, dayStart, dayEnd)}
    GROUP BY e.expense_type`);
  return rows.map((r) => ({ expense_type: r.expense_type, s: new Prisma.Decimal(String(r.s ?? 0)) }));
}

/** Ta'minotchiga to'lovlar (stornosiz) — Terminal/Naqd to'lov usuli bo'yicha. */
export async function aggregateDeskSupplierPayments(
  tenantId: number,
  cashDeskId: number,
  range: Range,
  dayStart: Date,
  dayEnd: Date,
  methods: PaymentMethodEntryDto[]
): Promise<Split> {
  const rows = await prisma.$queryRaw<Array<{ payment_method: string | null; s: unknown }>>(Prisma.sql`
    SELECT sp.payment_method::text AS payment_method, SUM(sp.amount) AS s
    FROM supplier_payments sp
    WHERE sp.tenant_id = ${tenantId}
      AND sp.cash_desk_id = ${cashDeskId}
      AND sp.reversed_at IS NULL
      AND ${rangeSql(Prisma.sql`sp.paid_at`, range, dayStart, dayEnd)}
    GROUP BY sp.payment_method`);
  let out: Split = { ...ZERO };
  for (const r of rows) {
    out = applySignedAmount(out, r.payment_method ?? "", new Prisma.Decimal(String(r.s ?? 0)), methods, 1);
  }
  return out;
}
