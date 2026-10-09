import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import { resolveMethodForPaymentType } from "../reports/cash-flow.helpers";

type LedgerDb = Pick<Prisma.TransactionClient, "$queryRaw" | "tenant">;

export type CashDeskLedger = {
  default_currency: string;
  by_currency: Record<string, Decimal>;
  parts: { inflow: Decimal; client_expense: Decimal; supplier: Decimal; expenses: Decimal };
};

export type LedgerRefs = { methods: PaymentMethodEntryDto[]; defaultCurrency: string };

export async function loadLedgerRefs(db: LedgerDb, tenantId: number): Promise<LedgerRefs> {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const ref = ((t?.settings as Record<string, unknown> | null)?.references ?? {}) as Record<string, unknown>;
  const currencies = resolveCurrencyEntries(ref);
  return { methods: resolvePaymentMethodEntries(ref, currencies), defaultCurrency: defaultCurrencyCodeFromEntries(currencies) };
}

function currencyOf(method: string | null, refs: LedgerRefs): string {
  if (!method) return refs.defaultCurrency;
  return resolveMethodForPaymentType(method, refs.methods)?.currency_code || refs.defaultCurrency;
}

/**
 * Kassa qoldig'i valyuta bo'yicha:
 * mijoz kirimlari − mijoz rasxodi − ta'minotchiga to'lovlar − kassaga bog'langan tasdiqlangan xarajatlar
 * (avans va oylik to'lovlari ham xarajat sifatida shu ichida).
 */
export async function getCashDeskLedger(
  db: LedgerDb,
  tenantId: number,
  cashDeskId: number,
  refs?: LedgerRefs
): Promise<CashDeskLedger> {
  const r = refs ?? (await loadLedgerRefs(db, tenantId));
  const [payments, suppliers, expenses] = await Promise.all([
    db.$queryRaw<Array<{ entry_kind: string; payment_type: string | null; s: unknown }>>(Prisma.sql`
      SELECT entry_kind::text AS entry_kind, payment_type::text AS payment_type, SUM(amount) AS s
      FROM client_payments
      WHERE tenant_id = ${tenantId} AND cash_desk_id = ${cashDeskId}
        AND deleted_at IS NULL AND workflow_status = 'confirmed'
        AND entry_kind IN ('payment', 'client_expense')
      GROUP BY entry_kind, payment_type`),
    db.$queryRaw<Array<{ payment_method: string | null; s: unknown }>>(Prisma.sql`
      SELECT payment_method::text AS payment_method, SUM(amount) AS s
      FROM supplier_payments
      WHERE tenant_id = ${tenantId} AND cash_desk_id = ${cashDeskId} AND reversed_at IS NULL
      GROUP BY payment_method`),
    db.$queryRaw<Array<{ currency: string | null; s: unknown }>>(Prisma.sql`
      SELECT currency::text AS currency, SUM(amount) AS s
      FROM expenses
      WHERE tenant_id = ${tenantId} AND cash_desk_id = ${cashDeskId}
        AND deleted_at IS NULL AND status = 'approved'
      GROUP BY currency`)
  ]);
  const by: Record<string, Decimal> = {};
  const bump = (cur: string, v: Decimal) => {
    by[cur] = (by[cur] ?? new Decimal(0)).add(v);
  };
  const parts = { inflow: new Decimal(0), client_expense: new Decimal(0), supplier: new Decimal(0), expenses: new Decimal(0) };
  for (const p of payments) {
    const v = new Decimal(String(p.s ?? 0));
    const cur = currencyOf(p.payment_type, r);
    if (p.entry_kind === "payment") {
      bump(cur, v);
      parts.inflow = parts.inflow.add(v);
    } else {
      bump(cur, v.neg());
      parts.client_expense = parts.client_expense.add(v);
    }
  }
  for (const s of suppliers) {
    const v = new Decimal(String(s.s ?? 0));
    bump(currencyOf(s.payment_method, r), v.neg());
    parts.supplier = parts.supplier.add(v);
  }
  for (const e of expenses) {
    const v = new Decimal(String(e.s ?? 0));
    bump((e.currency || r.defaultCurrency).toUpperCase(), v.neg());
    parts.expenses = parts.expenses.add(v);
  }
  return { default_currency: r.defaultCurrency, by_currency: by, parts };
}

export async function getCashDeskAvailableInCurrency(
  db: LedgerDb,
  tenantId: number,
  cashDeskId: number,
  currency: string
): Promise<Decimal> {
  const l = await getCashDeskLedger(db, tenantId, cashDeskId);
  return l.by_currency[currency.toUpperCase()] ?? new Decimal(0);
}

/** Kassa qatorini tranzaksiya oxirigacha bloklash (parallel chiqimlar poygasiga qarshi). */
export async function lockCashDeskRow(tx: Prisma.TransactionClient, tenantId: number, cashDeskId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT id FROM cash_desks WHERE id = ${cashDeskId} AND tenant_id = ${tenantId} AND is_active = true FOR UPDATE`
  );
  return rows.length > 0;
}

export function ledgerToJson(l: CashDeskLedger) {
  return {
    default_currency: l.default_currency,
    by_currency: Object.fromEntries(Object.entries(l.by_currency).map(([k, v]) => [k, v.toDecimalPlaces(2).toString()])),
    parts: Object.fromEntries(Object.entries(l.parts).map(([k, v]) => [k, v.toDecimalPlaces(2).toString()]))
  };
}
