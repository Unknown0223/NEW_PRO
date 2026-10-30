import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { toFio } from "../staff/staff.shared.helpers";
import { PayrollError } from "./payroll.route-helpers";

export type CompareInputRow = { code: string; name?: string | null; columns: Record<string, number>; total?: number | null };

type Snapshot = {
  base?: { base_full?: number };
  attendance?: { plan_days?: number; worked?: number };
  kpi?: { fact_total?: { cost?: number }; plan_total?: { cost?: number }; returned_sum?: number };
  plan_meta?: { warnings?: string[] };
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru");
const BASE_COLS = new Set(["оклад", "базовый оклад", "оклад за отработанное время"]);
const GROSS_COLS = new Set(["начислено", "итого начислено", "итого", "всего"]);
const ADVANCE_COLS = new Set(["аванс", "авансы"]);
const r2 = (x: number) => Math.round(x * 100) / 100;
const fmt = (x: number) => r2(x).toLocaleString("ru-RU");

export type CompareCell = { column: string; excel: number; system: number | null; diff: number; reasons: string[] };

async function buildReport(tenantId: number, year: number, month: number, input: CompareInputRow[]) {
  const codes = [...new Set(input.map((r) => r.code.trim()).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, OR: [{ code: { in: codes } }, { login: { in: codes } }] },
    select: { id: true, code: true, login: true, name: true, first_name: true, last_name: true, middle_name: true }
  });
  const byCode = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (u.code) byCode.set(norm(u.code), u);
    if (u.login && !byCode.has(norm(u.login))) byCode.set(norm(u.login), u);
  }
  const [records, items] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: { tenant_id: tenantId, year, month, user_id: { in: users.map((u) => u.id) } },
      include: { lines: true }
    }),
    prisma.payrollItem.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } })
  ]);
  const recByUser = new Map(records.map((r) => [r.user_id, r]));
  const itemByName = new Map(items.map((i) => [norm(i.name), i]));

  const rows = input.map((row) => {
    const u = byCode.get(norm(row.code));
    const rec = u ? recByUser.get(u.id) : undefined;
    const snap = (rec?.calc_snapshot ?? {}) as Snapshot;
    const cols = { ...row.columns };
    if (row.total != null && !Object.keys(cols).some((k) => GROSS_COLS.has(norm(k)))) cols["Начислено"] = row.total;
    const cells: CompareCell[] = Object.entries(cols).map(([column, excelRaw]) => {
      const excel = r2(Number(excelRaw) || 0);
      const key = norm(column);
      if (!u) return { column, excel, system: null, diff: excel, reasons: ["Сотрудник с таким кодом не найден"] };
      if (!rec) return { column, excel, system: null, diff: excel, reasons: ["Нет расчёта в системе за этот месяц"] };
      const reasons: string[] = [];
      let system: number | null = null;
      if (BASE_COLS.has(key)) {
        system = Number(rec.base_salary);
        const a = snap.attendance ?? {};
        reasons.push(`Табель: отработано ${a.worked ?? 0} из ${a.plan_days ?? 0} дн., полный оклад ${fmt(snap.base?.base_full ?? 0)}`);
      } else if (GROSS_COLS.has(key)) {
        system = Number(rec.gross);
        reasons.push(
          `Оклад ${fmt(Number(rec.base_salary))} + надбавки ${fmt(Number(rec.allowances_total))} − удержания ${fmt(Number(rec.deductions_total))}`
        );
        const corr = rec.lines.filter((l) => l.corr_key !== "");
        for (const c of corr) reasons.push(`Корректировка за ${c.corr_key}: ${fmt(Number(c.amount))}`);
      } else if (ADVANCE_COLS.has(key)) {
        system = Number(rec.advances_total);
        reasons.push("Аванс — только выданные кассиром");
      } else {
        const item = itemByName.get(key);
        if (!item) return { column, excel, system: null, diff: excel, reasons: ["Колонка не найдена среди надбавок/удержаний"] };
        const lines = rec.lines.filter((l) => l.item_id === item.id);
        system = lines.reduce((s, l) => s + Number(l.amount), 0);
        for (const l of lines) {
          if (l.source === "manual" || l.is_manual_override) reasons.push("Ручная сумма");
          else if (l.corr_key) reasons.push(`Корректировка за ${l.corr_key}`);
          else if (l.formula_snapshot) reasons.push(`Формула: ${l.formula_snapshot}`);
        }
        if (lines.some((l) => l.source === "kpi" || l.source === "formula")) {
          const k = snap.kpi ?? {};
          reasons.push(`Факт ${fmt(k.fact_total?.cost ?? 0)} (возвраты −${fmt(k.returned_sum ?? 0)}), план ${fmt(k.plan_total?.cost ?? 0)}`);
          for (const w of snap.plan_meta?.warnings ?? []) reasons.push(w);
        }
        if (!lines.length) reasons.push("В системе строка не начислена");
      }
      system = r2(system ?? 0);
      return { column, excel, system, diff: r2(excel - system), reasons: Math.abs(excel - system) < 0.01 ? [] : reasons };
    });
    return {
      code: row.code,
      name: row.name ?? null,
      user_id: u?.id ?? null,
      fio: u ? toFio(u) : row.name ?? null,
      record_id: rec?.id ?? null,
      cells,
      diff_total: r2(cells.reduce((s, c) => s + Math.abs(c.diff), 0))
    };
  });
  return {
    rows,
    summary: {
      employees: rows.length,
      matched: rows.filter((r) => r.diff_total < 0.01).length,
      with_diff: rows.filter((r) => r.diff_total >= 0.01).length,
      not_found: rows.filter((r) => r.user_id == null).length
    }
  };
}

export async function createCompareBatch(tenantId: number, year: number, month: number, rows: CompareInputRow[], actorId: number | null) {
  const batch = await prisma.payrollCompareBatch.create({
    data: { tenant_id: tenantId, year, month, rows: rows as unknown as Prisma.InputJsonValue, created_by: actorId }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: batch.id,
    action: "payroll.compare.import",
    payload: { year, month, rows: rows.length }
  });
  return { batch: batchDto(batch), ...(await buildReport(tenantId, year, month, rows)) };
}

function batchDto(b: { id: number; year: number; month: number; created_at: Date; signed_off_by: number | null; signed_off_at: Date | null; sign_off_note: string | null }) {
  return {
    id: b.id,
    year: b.year,
    month: b.month,
    created_at: b.created_at.toISOString(),
    signed_off_by: b.signed_off_by,
    signed_off_at: b.signed_off_at?.toISOString() ?? null,
    sign_off_note: b.sign_off_note
  };
}

/** Oxirgi import qilingan Excel bilan joriy tizim natijasini qayta solishtirish. */
export async function getLatestCompare(tenantId: number, year: number, month: number) {
  const batch = await prisma.payrollCompareBatch.findFirst({
    where: { tenant_id: tenantId, year, month },
    orderBy: { created_at: "desc" }
  });
  if (!batch) return { batch: null, rows: [], summary: { employees: 0, matched: 0, with_diff: 0, not_found: 0 } };
  return { batch: batchDto(batch), ...(await buildReport(tenantId, year, month, batch.rows as unknown as CompareInputRow[])) };
}

export async function signOffCompare(tenantId: number, id: number, note: string | null, actorId: number | null) {
  const batch = await prisma.payrollCompareBatch.findFirst({ where: { id, tenant_id: tenantId } });
  if (!batch) throw new PayrollError("NOT_FOUND");
  if (batch.signed_off_at) throw new PayrollError("BAD_STATUS");
  const saved = await prisma.payrollCompareBatch.update({
    where: { id },
    data: { signed_off_by: actorId, signed_off_at: new Date(), sign_off_note: note?.trim().slice(0, 500) || null }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.compare.sign_off",
    payload: { year: batch.year, month: batch.month, note }
  });
  return batchDto(saved);
}
