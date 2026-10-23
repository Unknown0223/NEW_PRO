import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { invalidatePayrollEnabledCache } from "./payroll.dirty";

export type PayrollSystemKey = "advance" | "correction" | "carry";

export const PAYROLL_SYSTEM_ITEMS: Array<{
  name: string;
  type: "allowance" | "deduction";
  system_key: PayrollSystemKey;
  sort_order: number;
}> = [
  { name: "Аванс", type: "deduction", system_key: "advance", sort_order: 900 },
  { name: "Корректировка", type: "allowance", system_key: "correction", sort_order: 910 },
  { name: "Qarzdorlik", type: "deduction", system_key: "carry", sort_order: 920 }
];

export type PayrollSettingsDto = {
  enabled: boolean;
  parallel_run: boolean;
  salary_queue_enabled: boolean;
};

const DEFAULTS: PayrollSettingsDto = { enabled: false, parallel_run: false, salary_queue_enabled: true };

export async function getPayrollSettings(tenantId: number): Promise<PayrollSettingsDto> {
  const row = await prisma.payrollSettings.findUnique({ where: { tenant_id: tenantId } });
  if (!row) return { ...DEFAULTS };
  return {
    enabled: row.enabled,
    parallel_run: row.parallel_run,
    salary_queue_enabled: row.salary_queue_enabled
  };
}

export async function isPayrollEnabled(tenantId: number): Promise<boolean> {
  return (await getPayrollSettings(tenantId)).enabled;
}

export async function updatePayrollSettings(
  tenantId: number,
  patch: Partial<PayrollSettingsDto>,
  actorUserId: number | null
): Promise<PayrollSettingsDto> {
  const data = {
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.parallel_run !== undefined ? { parallel_run: patch.parallel_run } : {}),
    ...(patch.salary_queue_enabled !== undefined ? { salary_queue_enabled: patch.salary_queue_enabled } : {})
  };
  await prisma.payrollSettings.upsert({
    where: { tenant_id: tenantId },
    create: { tenant_id: tenantId, ...DEFAULTS, ...data },
    update: data
  });
  invalidatePayrollEnabledCache(tenantId);
  if (patch.enabled) {
    await ensurePayrollSystemItems(tenantId);
    const { ensurePayrollFinanceCategories } = await import("../expenses/expenses.payroll-guard");
    await ensurePayrollFinanceCategories(tenantId);
  }
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.payroll,
    entityId: "payroll_settings",
    action: "payroll.settings.update",
    payload: data
  });
  return getPayrollSettings(tenantId);
}

export async function ensurePayrollSystemItems(tenantId: number): Promise<void> {
  await prisma.payrollItem.createMany({
    data: PAYROLL_SYSTEM_ITEMS.map((i) => ({
      tenant_id: tenantId,
      name: i.name,
      type: i.type,
      calc_type: "system",
      system_key: i.system_key,
      sort_order: i.sort_order
    })),
    skipDuplicates: true
  });
}

export async function getSystemItemIds(tenantId: number): Promise<Record<PayrollSystemKey, number>> {
  await ensurePayrollSystemItems(tenantId);
  const rows = await prisma.payrollItem.findMany({
    where: { tenant_id: tenantId, system_key: { in: ["advance", "correction", "carry"] } },
    select: { id: true, system_key: true }
  });
  const out = {} as Record<PayrollSystemKey, number>;
  for (const r of rows) out[r.system_key as PayrollSystemKey] = r.id;
  return out;
}
