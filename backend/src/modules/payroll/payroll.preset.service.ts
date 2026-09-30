import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { currentPayrollMonth, markPayrollDirtyForTenant } from "./payroll.dirty";
import { assignResKpiGroups, type ResAssignResult } from "./payroll.preset.assign";
import { mergeItemAmounts, parseItemAmounts } from "./payroll.item-amounts.pure";
import { validateFormula } from "./payroll.formula-engine";
import { knownVariableSet } from "./payroll.formula-vars";
import { RES_FORMULAS, RES_ITEMS, RES_ROLE_COLUMNS, RES_ROLE_DEFAULTS } from "./payroll.preset.pure";

export type PresetResult = {
  items_created: string[];
  formulas_created: string[];
  roles_updated: string[];
  kpi: ResAssignResult | null;
};

/** Idempotent: mavjud statya/formula (nomi bo'yicha) va qo'lda kiritilgan summalar o'zgartirilmaydi. */
export async function applyResPreset(
  tenantId: number,
  actorId: number | null,
  ym?: { year: number; month: number }
): Promise<PresetResult> {
  const out: PresetResult = { items_created: [], formulas_created: [], roles_updated: [], kpi: null };
  const ids = new Map<string, number>();
  for (const spec of RES_ITEMS) {
    const found = await prisma.payrollItem.findFirst({ where: { tenant_id: tenantId, name: spec.name }, select: { id: true } });
    if (found) {
      ids.set(spec.key, found.id);
      continue;
    }
    const row = await prisma.payrollItem.create({
      data: {
        tenant_id: tenantId,
        name: spec.name,
        type: "allowance",
        calc_type: spec.calc,
        sort_order: spec.sort,
        comment: spec.comment
      }
    });
    ids.set(spec.key, row.id);
    out.items_created.push(spec.name);
  }

  const allNames = (await prisma.payrollItem.findMany({ where: { tenant_id: tenantId }, select: { name: true } })).map((i) => i.name);
  const known = knownVariableSet(allNames);
  for (const f of RES_FORMULAS) {
    const v = validateFormula(f.text, known);
    if (!v.ok) throw new Error(`preset formula «${f.name}»: ${v.error}`);
    const exists = await prisma.payrollFormula.findFirst({ where: { tenant_id: tenantId, name: f.name }, select: { id: true } });
    if (exists) continue;
    await prisma.payrollFormula.create({
      data: {
        tenant_id: tenantId,
        name: f.name,
        scope: f.scope,
        text: f.text,
        role: f.role,
        target_item_id: f.itemKey ? ids.get(f.itemKey)! : null,
        priority: f.priority,
        created_by: actorId
      }
    });
    out.formulas_created.push(f.name);
  }

  const columnIds = RES_ROLE_COLUMNS.map((k) => ids.get(k)!);
  for (const [role, def] of Object.entries(RES_ROLE_DEFAULTS)) {
    const prev = await prisma.payrollRoleConfig.findUnique({ where: { tenant_id_role: { tenant_id: tenantId, role } } });
    const prevParts = parseItemAmounts(prev?.item_amounts);
    const patch: Record<string, number> = {};
    for (const [k, amount] of Object.entries(def.parts)) {
      const id = String(ids.get(k)!);
      if (prevParts[id] == null) patch[id] = amount;
    }
    const prevCols = prev?.allowance_item_ids ?? [];
    const data = {
      allowance_item_ids: prevCols.length ? [...new Set([...prevCols, ...columnIds])] : [],
      item_amounts: mergeItemAmounts(prev?.item_amounts, patch),
      ...(!prev || Number(prev.base_amount) === 0 ? { base_amount: new Prisma.Decimal(def.base) } : {})
    };
    await prisma.payrollRoleConfig.upsert({
      where: { tenant_id_role: { tenant_id: tenantId, role } },
      create: { tenant_id: tenantId, role, ...data },
      update: data
    });
    out.roles_updated.push(role);
  }

  const { year, month } = ym ?? (await currentPayrollMonth(tenantId));
  out.kpi = await assignResKpiGroups(tenantId, year, month, actorId);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: "preset:res",
    action: "payroll.preset.apply",
    payload: out
  });
  void markPayrollDirtyForTenant(tenantId, "preset");
  return out;
}
