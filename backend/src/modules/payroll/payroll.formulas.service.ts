import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  evaluateFormula,
  normalizeVarName,
  parseFormula,
  validateFormula,
  type FormulaValidation
} from "./payroll.formula-engine";
import { buildFormulaVars, knownVariableSet, staticVariableGroups } from "./payroll.formula-vars";
import { partVarName } from "./payroll.item-amounts.pure";
import { loadPayrollCalcContext, loadPayrollUser } from "./payroll.calc-context";
import { loadPayrollInputs } from "./payroll.inputs";
import { markPayrollDirtyForTenant } from "./payroll.dirty";
import { PayrollError } from "./payroll.route-helpers";

export type PayrollFormulaDto = {
  id: number;
  name: string;
  scope: string;
  text: string;
  role: string | null;
  target_item_id: number | null;
  target_item_name: string | null;
  priority: number;
  is_active: boolean;
  assignments: number;
  updated_at: string;
};

export type PayrollFormulaInput = {
  name?: string;
  scope?: "bonus" | "allowance" | "salary" | "common";
  text?: string;
  role?: string | null;
  target_item_id?: number | null;
  priority?: number;
  is_active?: boolean;
};

async function itemNames(tenantId: number): Promise<Map<number, string>> {
  const rows = await prisma.payrollItem.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function validatePayrollFormulaText(tenantId: number, text: string): Promise<FormulaValidation> {
  const names = await itemNames(tenantId);
  return validateFormula(text, knownVariableSet([...names.values()]));
}

async function assertValid(tenantId: number, text: string) {
  const v = await validatePayrollFormulaText(tenantId, text);
  if (!v.ok) throw new PayrollError("FORMULA_INVALID", { error: v.error, pos: v.pos, unknown: v.unknown });
}

export async function listPayrollFormulas(tenantId: number): Promise<PayrollFormulaDto[]> {
  const [rows, names, counts] = await Promise.all([
    prisma.payrollFormula.findMany({ where: { tenant_id: tenantId }, orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    itemNames(tenantId),
    prisma.payrollBonusAssignment.groupBy({ by: ["formula_id"], where: { tenant_id: tenantId }, _count: { _all: true } })
  ]);
  const cnt = new Map(counts.map((c) => [c.formula_id, c._count._all]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    text: r.text,
    role: r.role,
    target_item_id: r.target_item_id,
    target_item_name: r.target_item_id ? names.get(r.target_item_id) ?? null : null,
    priority: r.priority,
    is_active: r.is_active,
    assignments: cnt.get(r.id) ?? 0,
    updated_at: r.updated_at.toISOString()
  }));
}

async function assertTarget(tenantId: number, itemId: number | null | undefined) {
  if (itemId == null) return;
  const it = await prisma.payrollItem.findFirst({ where: { id: itemId, tenant_id: tenantId }, select: { system_key: true } });
  if (!it) throw new PayrollError("BAD_ITEM");
  if (it.system_key) throw new PayrollError("SYSTEM_ITEM");
}

export async function createPayrollFormula(tenantId: number, input: PayrollFormulaInput, actorId: number | null) {
  const name = input.name?.trim();
  const text = input.text?.trim();
  if (!name || !text) throw new PayrollError("FORMULA_INVALID", { error: "Название и формула обязательны" });
  await assertValid(tenantId, text);
  await assertTarget(tenantId, input.target_item_id);
  const row = await prisma.payrollFormula.create({
    data: {
      tenant_id: tenantId,
      name: name.slice(0, 200),
      scope: input.scope ?? "common",
      text,
      role: input.role?.trim() || null,
      target_item_id: input.target_item_id ?? null,
      priority: input.priority ?? 100,
      is_active: input.is_active ?? true,
      created_by: actorId
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: row.id,
    action: "payroll.formula.create",
    payload: { name: row.name, text: row.text, role: row.role }
  });
  void markPayrollDirtyForTenant(tenantId, "formula");
  return row;
}

/** Ochiq (yopilmagan) oylardagi biriktirmalar snapshot'i yangilanadi; yopiq oylar o'zgarmaydi. */
export async function updatePayrollFormula(tenantId: number, id: number, input: PayrollFormulaInput, actorId: number | null) {
  const prev = await prisma.payrollFormula.findFirst({ where: { id, tenant_id: tenantId } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  const text = input.text?.trim();
  if (text !== undefined) {
    if (!text) throw new PayrollError("FORMULA_INVALID", { error: "Формула пустая" });
    await assertValid(tenantId, text);
  }
  if (input.target_item_id !== undefined) await assertTarget(tenantId, input.target_item_id);
  const row = await prisma.payrollFormula.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 200) } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(input.role !== undefined ? { role: input.role?.trim() || null } : {}),
      ...(input.target_item_id !== undefined ? { target_item_id: input.target_item_id } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {})
    }
  });
  if (text !== undefined && text !== prev.text) {
    const closed = await prisma.payrollPeriod.findMany({
      where: { tenant_id: tenantId, status: "closed" },
      select: { year: true, month: true }
    });
    const closedKeys = new Set(closed.map((c) => c.year * 100 + c.month));
    const assigns = await prisma.payrollBonusAssignment.findMany({
      where: { tenant_id: tenantId, formula_id: id },
      select: { id: true, year: true, month: true }
    });
    const openIds = assigns.filter((a) => !closedKeys.has(a.year * 100 + a.month)).map((a) => a.id);
    if (openIds.length) {
      await prisma.payrollBonusAssignment.updateMany({ where: { id: { in: openIds } }, data: { formula_text_snapshot: text } });
    }
  }
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.formula.update",
    payload: { before: { text: prev.text, role: prev.role, is_active: prev.is_active }, after: input }
  });
  void markPayrollDirtyForTenant(tenantId, "formula");
  return row;
}

export async function deletePayrollFormula(tenantId: number, id: number, actorId: number | null) {
  const prev = await prisma.payrollFormula.findFirst({ where: { id, tenant_id: tenantId } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  const used = await prisma.payrollBonusAssignment.count({ where: { tenant_id: tenantId, formula_id: id } });
  if (used > 0) throw new PayrollError("FORMULA_IN_USE", { assignments: used });
  await prisma.payrollFormula.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.formula.delete",
    payload: { name: prev.name, text: prev.text }
  });
  void markPayrollDirtyForTenant(tenantId, "formula");
}

export async function listFormulaVariables(tenantId: number) {
  const [items, groups] = await Promise.all([
    prisma.payrollItem.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, type: true, system_key: true },
      orderBy: [{ type: "asc" }, { sort_order: "asc" }]
    }),
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }]
    })
  ]);
  return {
    groups: [
      ...staticVariableGroups(),
      { group: "Надбавки", items: items.filter((i) => i.type === "allowance").map((i) => i.name) },
      {
        group: "Базовые оклады (части)",
        items: items.filter((i) => i.type === "allowance" && !i.system_key).map((i) => partVarName(i.name))
      },
      { group: "Удержания", items: items.filter((i) => i.type === "deduction").map((i) => i.name) }
    ],
    functions: ["ЕСЛИ", "И", "ИЛИ", "НЕ", "ОКРУГЛ", "ОКРУГЛВВЕРХ", "ОКРУГЛВНИЗ", "MIN", "MAX", "ABS", "СУММ"],
    kpi_groups: groups
  };
}

/** Real xodim ma'lumotlari bilan formulani sinab ko'rish. */
export async function previewPayrollFormula(
  tenantId: number,
  input: { text: string; user_id: number; year: number; month: number; kpi_group_id?: number | null; target_item_id?: number | null }
) {
  const v = await validatePayrollFormulaText(tenantId, input.text);
  if (!v.ok) return { ok: false as const, validation: v };
  const user = await loadPayrollUser(tenantId, input.user_id);
  if (!user) throw new PayrollError("BAD_USER");
  const ctx = await loadPayrollCalcContext(tenantId);
  const loaded = await loadPayrollInputs(tenantId, user, input.year, input.month, ctx.env, ctx.productGroups);
  const rec = await prisma.payrollRecord.findUnique({
    where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: user.id, year: input.year, month: input.month } },
    include: { lines: true }
  });
  const itemValues = new Map<string, number>();
  for (const l of rec?.lines ?? []) {
    const name = ctx.items.get(l.item_id)?.name;
    if (name) itemValues.set(name, (itemValues.get(name) ?? 0) + Number(l.amount));
  }
  const vars = buildFormulaVars(
    loaded.inputs,
    input.kpi_group_id ?? null,
    itemValues,
    { allowances: Number(rec?.allowances_total ?? 0), deductions: Number(rec?.deductions_total ?? 0) },
    ctx.items,
    input.target_item_id ?? null
  );
  const res = evaluateFormula(parseFormula(input.text), vars);
  const used = Object.fromEntries(v.variables.map((name) => [name, vars.get(normalizeVarName(name)) ?? 0]));
  return { ok: true as const, value: res.value, warnings: res.warnings, variables: used };
}
