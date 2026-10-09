import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { withTransaction } from "../../lib/db-context";
import { tenantMonthRangeUtc } from "../../lib/workday-calendar";
import { computePayroll, type CalcLine, type CalcResult, type KeptLine } from "./payroll.calc.pure";
import { loadPayrollCalcContext, loadPayrollUser, resolveUserFormulas, type PayrollCalcContext } from "./payroll.calc-context";
import { nextYm, prevYm } from "./payroll.dirty";
import { loadPayrollInputs, stableInputsJson, type LoadedPayrollInputs, type PayrollUserSnapshot } from "./payroll.inputs";
import { notifyPermissionHolders } from "./payroll.notify";
import { isPayrollEnabled } from "./payroll.settings";

export type RecalcOpts = { trigger: string; force?: boolean; ctx?: PayrollCalcContext };
export type RecalcOutcome = {
  status: "skipped" | "unchanged" | "updated" | "frozen" | "error";
  record_id?: number;
  error?: string;
  correction?: { year: number; month: number; amount: number };
};

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const dec = (v: unknown) => Number(v ?? 0);

async function clearDirty(recordId: number, startedAt: Date) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE payroll_records SET dirty_at = NULL, dirty_reasons = '[]'::jsonb
    WHERE id = ${recordId} AND (dirty_at IS NULL OR dirty_at <= ${startedAt})`);
}

async function isMonthFrozen(tenantId: number, year: number, month: number): Promise<boolean> {
  const p = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  return p?.status === "closed";
}

function mapToObj(m: Map<number, unknown> | null | undefined): Record<string, unknown> | null {
  return m ? Object.fromEntries([...m.entries()].map(([k, v]) => [String(k), v])) : null;
}

function buildSnapshot(loaded: LoadedPayrollInputs, res: CalcResult, trigger: string) {
  const i = loaded.inputs;
  return {
    trigger,
    base: { ...loaded.base, item_parts: mapToObj(loaded.base.item_parts) },
    attendance: loaded.attendance,
    kpi: {
      fact_total: i.fact_total,
      fact_by_group: mapToObj(i.fact_by_group),
      plan_total: i.plan_total,
      plan_by_group: mapToObj(i.plan_by_group),
      returned_sum: i.returned_sum,
      team_total: i.team_total,
      team_plan_total: i.team_plan_total ?? null,
      team_plan_by_group: mapToObj(i.team_plan_by_group),
      expeditor: i.expeditor
    },
    plan_meta: loaded.plan_meta,
    fact_meta: loaded.fact_meta,
    formula_values: res.formula_values,
    warnings: [...res.warnings, ...loaded.plan_meta.warnings],
    salary_paid: res.salary_paid
  };
}

async function writeLines(tx: Prisma.TransactionClient, recordId: number, lines: CalcLine[]) {
  const keep = lines.map((l) => `${l.item_id}|${l.corr_key}`);
  const existing = await tx.payrollRecordLine.findMany({ where: { record_id: recordId }, select: { id: true, item_id: true, corr_key: true } });
  const drop = existing.filter((e) => !keep.includes(`${e.item_id}|${e.corr_key}`)).map((e) => e.id);
  if (drop.length) await tx.payrollRecordLine.deleteMany({ where: { id: { in: drop } } });
  for (const l of lines) {
    const data = {
      amount: l.amount,
      source: l.source,
      formula_snapshot: l.formula_snapshot,
      is_manual_override: l.is_manual_override,
      correction_for_year: l.correction_for_year,
      correction_for_month: l.correction_for_month,
      note: l.note
    };
    await tx.payrollRecordLine.upsert({
      where: { record_id_item_id_corr_key: { record_id: recordId, item_id: l.item_id, corr_key: l.corr_key } },
      create: { record_id: recordId, item_id: l.item_id, corr_key: l.corr_key, ...data },
      update: data
    });
  }
}

async function sumSalaryPaid(tenantId: number, userId: number, year: number, month: number): Promise<number> {
  const agg = await prisma.payrollPayout.aggregate({
    where: { tenant_id: tenantId, user_id: userId, year, month, kind: "salary", status: "paid" },
    _sum: { amount_uzs: true }
  });
  return dec(agg._sum.amount_uzs);
}

async function carryFromPrev(tenantId: number, userId: number, year: number, month: number): Promise<number> {
  const p = prevYm({ year, month });
  const prev = await prisma.payrollRecord.findUnique({
    where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: userId, year: p.year, month: p.month } },
    select: { balance: true }
  });
  const b = dec(prev?.balance);
  return b < 0 ? Math.round(-b * 100) / 100 : 0;
}

/** Bitta xodim-oy qayta hisobi (avtonom). Muzlatilgan oy farqi keyingi ochiq oyga tuzatish bo'ladi. */
export async function recalcPayrollRecord(
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  opts: RecalcOpts
): Promise<RecalcOutcome> {
  const startedAt = new Date();
  if (!(await isPayrollEnabled(tenantId))) return { status: "skipped" };
  const record = await prisma.payrollRecord.findUnique({
    where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: userId, year, month } },
    include: { lines: true }
  });
  const user = await loadPayrollUser(tenantId, userId);
  if (!user || user.role === "admin") {
    if (record) await clearDirty(record.id, startedAt);
    return { status: "skipped", record_id: record?.id };
  }
  const ctx = opts.ctx ?? (await loadPayrollCalcContext(tenantId));
  const range = tenantMonthRangeUtc(year, month, ctx.env.timeZone);
  const placeholder = record != null && !record.calculated_at && record.status === "draft" && record.lines.length === 0;
  const dropPlaceholder = async (): Promise<RecalcOutcome> => {
    if (placeholder) await prisma.payrollRecord.deleteMany({ where: { id: record!.id, calculated_at: null, status: "draft" } });
    return { status: "skipped" };
  };
  if (!record || placeholder) {
    if (user.hired_at && user.hired_at >= range.to) return dropPlaceholder();
    if (user.dismissed_at && user.dismissed_at < range.from) return dropPlaceholder();
  }

  try {
    const loaded = await loadPayrollInputs(tenantId, user, year, month, ctx.env, ctx.productGroups);
    const { salaryFormula, formulas } = await resolveUserFormulas(ctx, user, year, month);
    const [carry, salaryPaid] = await Promise.all([
      carryFromPrev(tenantId, userId, year, month),
      sumSalaryPaid(tenantId, userId, year, month)
    ]);
    const kept: KeptLine[] = (record?.lines ?? [])
      .filter((l) => l.source === "manual" || l.is_manual_override || l.corr_key !== "")
      .map((l) => ({
        item_id: l.item_id,
        amount: dec(l.amount),
        source: l.source,
        corr_key: l.corr_key,
        is_manual_override: l.is_manual_override,
        correction_for_year: l.correction_for_year,
        correction_for_month: l.correction_for_month,
        note: l.note
      }));
    const res = computePayroll({
      inputs: loaded.inputs,
      items: ctx.items,
      salaryFormula,
      formulas,
      kept,
      systemIds: ctx.systemIds,
      carryAmount: carry,
      salaryPaid
    });
    const hash = createHash("sha256")
      .update(stableInputsJson(loaded.inputs))
      .update(JSON.stringify({ salaryFormula, formulas, kept, carry, salaryPaid, cur: loaded.base.currency }))
      .digest("hex");

    if ((!record || placeholder) && loaded.base.base_full === 0 && res.lines.length === 0 && res.paid_total === 0 && carry === 0) {
      return dropPlaceholder();
    }
    const frozen = record != null && (record.status === "confirmed" || (await isMonthFrozen(tenantId, year, month)));
    if (record && record.inputs_hash === hash && !opts.force && !record.calc_error) {
      await clearDirty(record.id, startedAt);
      return { status: "unchanged", record_id: record.id };
    }
    if (frozen && record) {
      return await handleFrozen(tenantId, user, year, month, record, res, hash, startedAt, opts, ctx);
    }

    const snapshot = buildSnapshot(loaded, res, opts.trigger);
    const slotIds = [...new Set([...loaded.fact_meta.slot_ids, ...(loaded.plan_meta.slots as Array<{ slot_id: number }>).map((s) => s.slot_id)])];
    const data = {
      currency: loaded.base.currency,
      base_salary: res.base_salary,
      plan_days: loaded.inputs.plan_days,
      worked_days: loaded.inputs.worked_days,
      allowances_total: res.allowances_total,
      deductions_total: res.deductions_total,
      advances_total: res.advances_total,
      gross: res.gross,
      paid_total: res.paid_total,
      balance: res.balance,
      role: user.role,
      position: user.position,
      branch: user.branch,
      trade_direction_id: user.trade_direction_id,
      slot_ids: slotIds,
      employment_from: user.hired_at,
      employment_to: user.dismissed_at,
      calc_snapshot: snapshot as Prisma.InputJsonValue,
      inputs_hash: hash,
      calculated_at: new Date(),
      calc_error: res.errors.length ? res.errors.join("; ").slice(0, 1000) : null
    };
    const saved = await withTransaction(async (tx) => {
      const rec = await tx.payrollRecord.upsert({
        where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: userId, year, month } },
        create: { tenant_id: tenantId, user_id: userId, year, month, ...data },
        update: data
      });
      await writeLines(tx, rec.id, res.lines);
      return rec;
    });
    await clearDirty(saved.id, startedAt);
    if (res.errors.length && !record?.calc_error) {
      notifyPermissionHolders(tenantId, ["staff.zarplaty.update"], {
        title: "Ошибка формулы в зарплате",
        body: `${ym(year, month)}: ${res.errors[0]}`,
        href: `/users/salary?month=${ym(year, month)}&user=${userId}`
      });
    }
    return { status: "updated", record_id: saved.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e, tenantId, userId, year, month }, "payroll recalc failed");
    if (record) {
      await prisma.payrollRecord.update({ where: { id: record.id }, data: { calc_error: msg.slice(0, 1000) } });
    }
    return { status: "error", record_id: record?.id, error: msg };
  }
}

type RecordWithLines = NonNullable<Awaited<ReturnType<typeof prisma.payrollRecord.findUnique>>> & {
  lines: Array<{ item_id: number; corr_key: string; amount: Prisma.Decimal }>;
};

async function handleFrozen(
  tenantId: number,
  user: PayrollUserSnapshot,
  year: number,
  month: number,
  record: RecordWithLines,
  res: CalcResult,
  hash: string,
  startedAt: Date,
  opts: RecalcOpts,
  ctx: PayrollCalcContext
): Promise<RecalcOutcome> {
  const frozenGross = dec((record.frozen_snapshot as { gross?: number } | null)?.gross ?? record.gross);
  const paid = res.paid_total;
  const advLine = res.lines.find((l) => l.item_id === ctx.systemIds.advance);
  await withTransaction(async (tx) => {
    await tx.payrollRecord.update({
      where: { id: record.id },
      data: {
        advances_total: res.advances_total,
        paid_total: paid,
        balance: Math.round((frozenGross - paid) * 100) / 100,
        inputs_hash: hash,
        calc_snapshot: {
          ...(record.calc_snapshot as Record<string, unknown>),
          frozen_recheck: { at: new Date().toISOString(), live_gross: res.gross, trigger: opts.trigger }
        } as Prisma.InputJsonValue
      }
    });
    if (advLine) {
      await tx.payrollRecordLine.upsert({
        where: { record_id_item_id_corr_key: { record_id: record.id, item_id: advLine.item_id, corr_key: "" } },
        create: { record_id: record.id, item_id: advLine.item_id, corr_key: "", amount: advLine.amount, source: "advance" },
        update: { amount: advLine.amount }
      });
    } else {
      await tx.payrollRecordLine.deleteMany({ where: { record_id: record.id, item_id: ctx.systemIds.advance, corr_key: "" } });
    }
  });
  await clearDirty(record.id, startedAt);

  const corrKey = ym(year, month);
  const delta = Math.round((res.gross - frozenGross) * 100) / 100;
  const existing = await prisma.payrollRecordLine.findMany({
    where: { corr_key: corrKey, item_id: ctx.systemIds.correction, record: { tenant_id: tenantId, user_id: user.id } },
    select: { id: true, amount: true, record: { select: { id: true, year: true, month: true, status: true } } }
  });
  let frozenSum = 0;
  for (const e of existing) {
    const f = e.record.status === "confirmed" || (await isMonthFrozen(tenantId, e.record.year, e.record.month));
    if (f) frozenSum += dec(e.amount);
  }
  const needed = Math.round((delta - frozenSum) * 100) / 100;

  let target = nextYm({ year, month });
  let targetRecord: { id: number; status: string } | null = null;
  for (let i = 0; i < 24; i++) {
    targetRecord = await prisma.payrollRecord.findUnique({
      where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: user.id, year: target.year, month: target.month } },
      select: { id: true, status: true }
    });
    const closed = targetRecord?.status === "confirmed" || (await isMonthFrozen(tenantId, target.year, target.month));
    if (!closed) break;
    target = nextYm(target);
  }
  const openLine = existing.find((e) => e.record.year === target.year && e.record.month === target.month);
  if (Math.abs(needed) < 0.01 && !openLine) return { status: "frozen", record_id: record.id };

  const recId =
    targetRecord?.id ??
    (
      await prisma.payrollRecord.upsert({
        where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: user.id, year: target.year, month: target.month } },
        create: { tenant_id: tenantId, user_id: user.id, year: target.year, month: target.month, role: user.role, branch: user.branch },
        update: {}
      })
    ).id;
  await prisma.payrollRecordLine.upsert({
    where: { record_id_item_id_corr_key: { record_id: recId, item_id: ctx.systemIds.correction, corr_key: corrKey } },
    create: {
      record_id: recId,
      item_id: ctx.systemIds.correction,
      corr_key: corrKey,
      amount: needed,
      source: "correction",
      correction_for_year: year,
      correction_for_month: month,
      note: `Корректировка за ${corrKey}`
    },
    update: { amount: needed }
  });
  if (!openLine && Math.abs(needed) >= 0.01) {
    notifyPermissionHolders(tenantId, ["staff.zarplaty.view"], {
      title: "Корректировка зарплаты",
      body: `Изменились данные закрытого месяца ${corrKey}: ${needed.toLocaleString("ru-RU")} → ${ym(target.year, target.month)}`,
      href: `/users/salary?month=${ym(target.year, target.month)}&user=${user.id}`
    });
  }
  await recalcPayrollRecord(tenantId, user.id, target.year, target.month, { trigger: "correction", force: true, ctx });
  return { status: "frozen", record_id: record.id, correction: { year: target.year, month: target.month, amount: needed } };
}
