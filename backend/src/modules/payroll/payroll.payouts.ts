import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { getCashDeskLedger, loadLedgerRefs, lockCashDeskRow } from "../cash-desks/cash-desk-ledger";
import { getLatestExchangeRate } from "../currency-rates/currency-exchange-rates.service";
import { PAYROLL_EXPENSE_TYPES } from "../expenses/expenses.payroll-guard";
import { resolveMethodForPaymentType } from "../reports/cash-flow.helpers";
import { assertAdvanceWithinLimit } from "./payroll.advance-limits";
import { cashDesksForBranch, cashierDeskIds, loadAdvanceUsers, loadTenantBranches, type AdvanceActor } from "./payroll.advances.shared";
import { markPayrollDirty } from "./payroll.dirty";
import { notifyPermissionHolders } from "./payroll.notify";
import { PayrollError } from "./payroll.route-helpers";

export type PayInput = {
  kind: "advance" | "salary";
  advance_id?: number;
  record_id?: number;
  cash_desk_id: number;
  payment_method_ref?: string | null;
  currency?: string | null;
  /** Oylik uchun qisman to'lov (UZS). */
  amount?: number | null;
  comment?: string | null;
};

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Hisob valyutasi (UZS) summasini to'lov valyutasiga o'girish. */
async function convert(tenantId: number, amountUzs: number, currency: string, base: string) {
  if (currency === base) return { amount: amountUzs, rate: 1, rate_date: null as Date | null };
  const direct = await getLatestExchangeRate(tenantId, currency, base, new Date());
  if (direct && Number(direct.rate) > 0) {
    return { amount: r2(amountUzs / Number(direct.rate)), rate: Number(direct.rate), rate_date: new Date(direct.rate_date) };
  }
  const inverse = await getLatestExchangeRate(tenantId, base, currency, new Date());
  if (inverse && Number(inverse.rate) > 0) {
    return { amount: r2(amountUzs * Number(inverse.rate)), rate: 1 / Number(inverse.rate), rate_date: new Date(inverse.rate_date) };
  }
  throw new PayrollError("NO_RATE", { currency, base });
}

async function assertDeskAllowed(tenantId: number, actor: AdvanceActor, deskId: number, employeeBranch: string | null) {
  const allowed = await cashierDeskIds(tenantId, actor);
  if (allowed && !allowed.includes(deskId)) throw new PayrollError("NOT_CASHIER_DESK");
  if (allowed) {
    const branchDesks = cashDesksForBranch(await loadTenantBranches(tenantId), employeeBranch);
    if (branchDesks.length && !branchDesks.includes(deskId)) throw new PayrollError("NOT_CASHIER_DESK", { branch: employeeBranch });
  }
}

/** «Выдать»: kassa FOR UPDATE → qoldiq (valyuta bo'yicha) → limit → PayrollPayout + Expense (approved). */
export async function payPayroll(tenantId: number, actor: AdvanceActor, input: PayInput) {
  const refs = await loadLedgerRefs(prisma, tenantId);
  const method = input.payment_method_ref ? resolveMethodForPaymentType(input.payment_method_ref, refs.methods) : null;
  const currency = (method?.currency_code || input.currency || refs.defaultCurrency).toUpperCase();

  let userId: number;
  let year: number;
  let month: number;
  let amountUzs: number;
  let advance: Awaited<ReturnType<typeof prisma.payrollAdvance.findFirst>> = null;
  let recordId: number | null = null;
  if (input.kind === "advance") {
    advance = await prisma.payrollAdvance.findFirst({ where: { id: input.advance_id ?? 0, tenant_id: tenantId } });
    if (!advance) throw new PayrollError("NOT_FOUND");
    if (advance.status !== "approved") throw new PayrollError("BAD_STATUS");
    userId = advance.user_id;
    year = advance.year;
    month = advance.month;
    amountUzs = Number(advance.amount);
  } else {
    const settings = await prisma.payrollSettings.findUnique({ where: { tenant_id: tenantId } });
    if (settings && !settings.salary_queue_enabled) throw new PayrollError("QUEUE_DISABLED");
    const rec = await prisma.payrollRecord.findFirst({ where: { id: input.record_id ?? 0, tenant_id: tenantId } });
    if (!rec) throw new PayrollError("NOT_FOUND");
    if (rec.status !== "confirmed") throw new PayrollError("BAD_STATUS");
    userId = rec.user_id;
    year = rec.year;
    month = rec.month;
    recordId = rec.id;
    amountUzs = input.amount != null ? r2(input.amount) : Number(rec.balance);
  }
  if (!(amountUzs > 0)) throw new PayrollError("BAD_AMOUNT");
  const user = (await loadAdvanceUsers(tenantId, [userId])).get(userId);
  if (!user) throw new PayrollError("BAD_USER");
  await assertDeskAllowed(tenantId, actor, input.cash_desk_id, advance?.branch_snapshot ?? user.branch);
  const conv = await convert(tenantId, amountUzs, currency, refs.defaultCurrency);

  const payout = await withTransaction(async (tx) => {
    if (!(await lockCashDeskRow(tx, tenantId, input.cash_desk_id))) throw new PayrollError("BAD_CASH_DESK");
    if (advance) {
      await assertAdvanceWithinLimit(tx, tenantId, { id: userId, role: user.role }, year, month, amountUzs, advance.id);
      const upd = await tx.payrollAdvance.updateMany({ where: { id: advance.id, status: "approved" }, data: { status: "paid" } });
      if (!upd.count) throw new PayrollError("BAD_STATUS");
    } else {
      const locked = await tx.$queryRaw<Array<{ gross: Prisma.Decimal; frozen_snapshot: Prisma.JsonValue }>>(
        Prisma.sql`SELECT gross, frozen_snapshot FROM payroll_records WHERE id = ${recordId} FOR UPDATE`
      );
      const gross = Number((locked[0]?.frozen_snapshot as { gross?: number } | null)?.gross ?? locked[0]?.gross ?? 0);
      const paid = await tx.payrollPayout.aggregate({
        where: { tenant_id: tenantId, user_id: userId, year, month, status: "paid" },
        _sum: { amount_uzs: true }
      });
      const balance = r2(gross - Number(paid._sum.amount_uzs ?? 0));
      if (amountUzs > balance + 0.001) throw new PayrollError("AMOUNT_EXCEEDS_BALANCE", { balance });
    }
    const ledger = await getCashDeskLedger(tx, tenantId, input.cash_desk_id, refs);
    const available = Number(ledger.by_currency[currency] ?? 0);
    if (available + 0.001 < conv.amount) throw new PayrollError("INSUFFICIENT_CASH", { available, required: conv.amount, currency });

    const now = new Date();
    const p = await tx.payrollPayout.create({
      data: {
        tenant_id: tenantId,
        kind: input.kind,
        user_id: userId,
        year,
        month,
        record_id: recordId,
        advance_id: advance?.id ?? null,
        cash_desk_id: input.cash_desk_id,
        payment_method_ref: input.payment_method_ref?.slice(0, 64) ?? null,
        amount: conv.amount,
        currency,
        rate: conv.rate,
        rate_date: conv.rate_date,
        amount_uzs: amountUzs,
        paid_at: now,
        paid_by: actor.userId,
        comment: input.comment?.trim().slice(0, 500) || null
      }
    });
    const exp = await tx.expense.create({
      data: {
        tenant_id: tenantId,
        expense_type: input.kind === "advance" ? PAYROLL_EXPENSE_TYPES.advance : PAYROLL_EXPENSE_TYPES.salary,
        amount: conv.amount,
        currency,
        status: "approved",
        note: `${input.kind === "advance" ? "Аванс" : "Зарплата"} ${user.fio} за ${year}-${String(month).padStart(2, "0")} (#${p.id})`,
        expense_date: now,
        created_by_user_id: actor.userId,
        approved_by_user_id: input.kind === "advance" ? advance?.approved_by ?? actor.userId : actor.userId,
        cash_desk_id: input.cash_desk_id,
        employee_user_id: userId,
        source_type: input.kind === "advance" ? PAYROLL_EXPENSE_TYPES.advance : PAYROLL_EXPENSE_TYPES.salary,
        source_id: p.id
      }
    });
    if (advance) await tx.payrollAdvance.update({ where: { id: advance.id }, data: { payout_id: p.id } });
    return tx.payrollPayout.update({ where: { id: p.id }, data: { expense_id: exp.id } });
  }).catch((e) => {
    if (e instanceof PayrollError && e.message === "INSUFFICIENT_CASH") {
      notifyPermissionHolders(tenantId, ["cash.vydacha_zarplaty.create"], {
        title: "Недостаточно средств в кассе",
        body: `Выплата ${user.fio}: нужно ${conv.amount} ${currency}`,
        href: "/finance/cashier-queue"
      });
    }
    throw e;
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actor.userId,
    entityType: AuditEntityType.payroll,
    entityId: payout.id,
    action: `payroll.payout.${input.kind}`,
    payload: { user_id: userId, amount: conv.amount, currency, amount_uzs: amountUzs, cash_desk_id: input.cash_desk_id }
  });
  await markPayrollDirty(tenantId, { userIds: [userId], year, month }, `payout_${input.kind}`);
  return payout;
}

/** Teskari o'tkazish — faqat admin, sabab majburiy. Expense soft-delete, kassa qoldig'i qaytadi. */
export async function reversePayout(tenantId: number, actor: AdvanceActor, id: number, reason: string) {
  if (actor.role !== "admin") throw new PayrollError("ADMIN_ONLY");
  const why = reason.trim();
  if (!why) throw new PayrollError("REASON_REQUIRED");
  const p = await prisma.payrollPayout.findFirst({ where: { id, tenant_id: tenantId } });
  if (!p) throw new PayrollError("NOT_FOUND");
  if (p.status !== "paid") throw new PayrollError("BAD_STATUS");
  await withTransaction(async (tx) => {
    const upd = await tx.payrollPayout.updateMany({
      where: { id, status: "paid" },
      data: { status: "reversed", reversed_by: actor.userId, reversed_at: new Date(), reverse_reason: why.slice(0, 500) }
    });
    if (!upd.count) throw new PayrollError("BAD_STATUS");
    if (p.expense_id) {
      await tx.expense.update({
        where: { id: p.expense_id },
        data: { deleted_at: new Date(), deleted_by_user_id: actor.userId, delete_reason_ref: `payout_reversed: ${why}`.slice(0, 128) }
      });
    }
    if (p.advance_id) {
      await tx.payrollAdvance.update({ where: { id: p.advance_id }, data: { status: "approved", payout_id: null, queue_key: new Date() } });
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actor.userId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.payout.reverse",
    payload: { reason: why, kind: p.kind, amount: Number(p.amount), currency: p.currency }
  });
  await markPayrollDirty(tenantId, { userIds: [p.user_id], year: p.year, month: p.month }, "payout_reverse");
}
