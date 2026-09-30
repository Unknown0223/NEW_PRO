import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { PayrollError } from "./payroll.route-helpers";

export type RecordsFilter = {
  year: number;
  month: number;
  roles?: string[];
  branches?: string[];
  statuses?: string[];
  positions?: string[];
  directionIds?: number[];
  q?: string;
  userIds?: number[];
};

export type PayrollColumn = { id: number; name: string; type: "allowance" | "deduction"; system_key: string | null; color: string | null };

export type PayrollRowDto = {
  id: number;
  user_id: number;
  fio: string;
  code: string | null;
  login: string | null;
  role: string | null;
  branch: string | null;
  position: string | null;
  trade_direction_id: number | null;
  trade_direction: string | null;
  is_active: boolean;
  status: string;
  currency: string;
  base_salary: number;
  plan_days: number;
  worked_days: number;
  lines: Record<string, number>;
  overrides: number[];
  corrections: Array<{ corr_key: string; amount: number }>;
  allowances_total: number;
  deductions_total: number;
  advances_total: number;
  salary_paid: number;
  paid_total: number;
  gross: number;
  balance: number;
  dirty: boolean;
  calculated_at: string | null;
  calc_error: string | null;
  confirmed_at: string | null;
  rejected_reason: string | null;
};

const n = (v: unknown) => Number(v ?? 0);

export async function listPayrollColumns(tenantId: number): Promise<PayrollColumn[]> {
  const rows = await prisma.payrollItem.findMany({
    where: { tenant_id: tenantId, OR: [{ is_active: true }, { NOT: { system_key: null } }] },
    select: { id: true, name: true, type: true, system_key: true, color: true },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }, { name: "asc" }]
  });
  return rows.map((r) => ({ ...r, type: r.type === "deduction" ? "deduction" : "allowance" }));
}

export async function listPayrollRecords(tenantId: number, f: RecordsFilter) {
  const where: Prisma.PayrollRecordWhereInput = { tenant_id: tenantId, year: f.year, month: f.month };
  if (f.roles?.length) where.role = { in: f.roles };
  if (f.branches?.length) where.branch = { in: f.branches };
  if (f.statuses?.length) where.status = { in: f.statuses };
  if (f.positions?.length) where.position = { in: f.positions };
  if (f.directionIds?.length) where.trade_direction_id = { in: f.directionIds };
  if (f.userIds?.length) where.user_id = { in: f.userIds };
  const [records, period, columns] = await Promise.all([
    prisma.payrollRecord.findMany({ where, include: { lines: true }, orderBy: [{ role: "asc" }, { user_id: "asc" }] }),
    prisma.payrollPeriod.findUnique({
      where: { tenant_id_year_month: { tenant_id: tenantId, year: f.year, month: f.month } },
      select: { status: true, closed_at: true, closed_by: true }
    }),
    listPayrollColumns(tenantId)
  ]);
  const directionIds = [...new Set(records.map((r) => r.trade_direction_id).filter((x): x is number => x != null))];
  const [users, directions] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: records.map((r) => r.user_id) } },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, code: true, login: true, is_active: true }
    }),
    directionIds.length
      ? prisma.tradeDirection.findMany({ where: { tenant_id: tenantId, id: { in: directionIds } }, select: { id: true, name: true } })
      : Promise.resolve([])
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const directionName = new Map(directions.map((d) => [d.id, d.name]));
  const q = f.q?.trim().toLocaleLowerCase("ru");
  const rows: PayrollRowDto[] = [];
  for (const r of records) {
    const u = byId.get(r.user_id);
    const fio = u ? toFio(u) : `#${r.user_id}`;
    if (q && !`${fio} ${u?.code ?? ""} ${u?.login ?? ""}`.toLocaleLowerCase("ru").includes(q)) continue;
    const lines: Record<string, number> = {};
    const corrections: PayrollRowDto["corrections"] = [];
    const overrides: number[] = [];
    for (const l of r.lines) {
      lines[String(l.item_id)] = Math.round((n(lines[String(l.item_id)]) + n(l.amount)) * 100) / 100;
      if (l.corr_key) corrections.push({ corr_key: l.corr_key, amount: n(l.amount) });
      if (l.is_manual_override) overrides.push(l.item_id);
    }
    rows.push({
      id: r.id,
      user_id: r.user_id,
      fio,
      code: u?.code ?? null,
      login: u?.login ?? null,
      role: r.role,
      branch: r.branch,
      position: r.position,
      trade_direction_id: r.trade_direction_id,
      trade_direction: r.trade_direction_id != null ? directionName.get(r.trade_direction_id) ?? null : null,
      is_active: u?.is_active ?? false,
      status: r.status,
      currency: r.currency,
      base_salary: n(r.base_salary),
      plan_days: n(r.plan_days),
      worked_days: n(r.worked_days),
      lines,
      overrides,
      corrections,
      allowances_total: n(r.allowances_total),
      deductions_total: n(r.deductions_total),
      advances_total: n(r.advances_total),
      salary_paid: Math.round((n(r.paid_total) - n(r.advances_total)) * 100) / 100,
      paid_total: n(r.paid_total),
      gross: n(r.gross),
      balance: n(r.balance),
      dirty: r.dirty_at != null,
      calculated_at: r.calculated_at?.toISOString() ?? null,
      calc_error: r.calc_error,
      confirmed_at: r.confirmed_at?.toISOString() ?? null,
      rejected_reason: r.rejected_reason
    });
  }
  rows.sort((a, b) => (a.role ?? "").localeCompare(b.role ?? "") || a.fio.localeCompare(b.fio, "ru"));
  const sum = (k: keyof PayrollRowDto) => Math.round(rows.reduce((s, x) => s + n(x[k]), 0) * 100) / 100;
  return {
    year: f.year,
    month: f.month,
    period: { status: period?.status ?? "open", closed_at: period?.closed_at?.toISOString() ?? null },
    columns,
    rows,
    totals: {
      count: rows.length,
      base_salary: sum("base_salary"),
      allowances_total: sum("allowances_total"),
      deductions_total: sum("deductions_total"),
      advances_total: sum("advances_total"),
      salary_paid: sum("salary_paid"),
      gross: sum("gross"),
      balance: sum("balance"),
      dirty: rows.filter((r) => r.dirty).length,
      errors: rows.filter((r) => r.calc_error).length
    }
  };
}

export async function getPayrollRecordDetail(tenantId: number, id: number) {
  const r = await prisma.payrollRecord.findFirst({ where: { id, tenant_id: tenantId }, include: { lines: true } });
  if (!r) throw new PayrollError("NOT_FOUND");
  const [items, payouts, advances, user] = await Promise.all([
    prisma.payrollItem.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true, type: true, system_key: true } }),
    prisma.payrollPayout.findMany({
      where: { tenant_id: tenantId, user_id: r.user_id, year: r.year, month: r.month },
      orderBy: { paid_at: "asc" }
    }),
    prisma.payrollAdvance.findMany({
      where: { tenant_id: tenantId, user_id: r.user_id, year: r.year, month: r.month },
      orderBy: { created_at: "asc" }
    }),
    prisma.user.findFirst({
      where: { id: r.user_id, tenant_id: tenantId },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, code: true, role: true }
    })
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  return {
    id: r.id,
    user: user ? { id: user.id, fio: toFio(user), code: user.code, role: user.role } : null,
    year: r.year,
    month: r.month,
    status: r.status,
    base_salary: n(r.base_salary),
    gross: n(r.gross),
    balance: n(r.balance),
    paid_total: n(r.paid_total),
    advances_total: n(r.advances_total),
    lines: r.lines.map((l) => ({
      item_id: l.item_id,
      item_name: itemById.get(l.item_id)?.name ?? `#${l.item_id}`,
      item_type: itemById.get(l.item_id)?.type ?? "allowance",
      amount: n(l.amount),
      source: l.source,
      corr_key: l.corr_key,
      formula_snapshot: l.formula_snapshot,
      is_manual_override: l.is_manual_override,
      note: l.note
    })),
    calc_snapshot: r.calc_snapshot,
    frozen_snapshot: r.frozen_snapshot,
    calc_error: r.calc_error,
    calculated_at: r.calculated_at?.toISOString() ?? null,
    confirmed_at: r.confirmed_at?.toISOString() ?? null,
    payouts: payouts.map((p) => ({
      id: p.id,
      kind: p.kind,
      amount: n(p.amount),
      currency: p.currency,
      amount_uzs: n(p.amount_uzs),
      paid_at: p.paid_at.toISOString(),
      status: p.status,
      cash_desk_id: p.cash_desk_id
    })),
    advances: advances.map((a) => ({
      id: a.id,
      amount: n(a.amount),
      status: a.status,
      approved_at: a.approved_at?.toISOString() ?? null,
      created_at: a.created_at.toISOString()
    }))
  };
}

/** Excel eksport uchun tekis qatorlar (ustun nomlari bilan). */
export async function exportPayrollRecords(tenantId: number, f: RecordsFilter) {
  const data = await listPayrollRecords(tenantId, f);
  const header = [
    "Код",
    "ФИО",
    "Роль",
    "Филиал",
    "Направление торговли",
    "Должность",
    "Статус",
    "Раб. дни (план)",
    "Отработано",
    "Валюта",
    "Оклад",
    ...data.columns.map((c) => c.name),
    "Начислено",
    "Аванс",
    "Выплаты",
    "Итого выдано",
    "Остаток"
  ];
  const rows = data.rows.map((r) => [
    r.code ?? "",
    r.fio,
    r.role ?? "",
    r.branch ?? "",
    r.trade_direction ?? "",
    r.position ?? "",
    r.status,
    r.plan_days,
    r.worked_days,
    r.currency,
    r.base_salary,
    ...data.columns.map((c) => r.lines[String(c.id)] ?? 0),
    r.gross,
    r.advances_total,
    r.salary_paid,
    r.paid_total,
    r.balance
  ]);
  return { header, rows };
}
