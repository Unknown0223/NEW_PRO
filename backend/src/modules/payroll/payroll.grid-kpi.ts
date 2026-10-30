import { prisma } from "../../config/database";
import { parseKpiAmounts, mergeKpiAmounts } from "./payroll.item-amounts.pure";
import { snaps, writeSnap } from "./payroll.grid-month";
import { ymKey } from "./payroll.grid-month.pure";
import { PayrollError } from "./payroll.route-helpers";
import { markPayrollDirtyForTenant } from "./payroll.dirty";

const EXCLUDED = ["admin"];

export async function payrollKpiGrid(tenantId: number, year: number, month: number) {
  const [groups, users] = await Promise.all([
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sort_order: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: { notIn: EXCLUDED }, is_active: true },
      select: { id: true, first_name: true, last_name: true, name: true, code: true, role: true, branch: true, trade_direction: true },
      orderBy: [{ role: "asc" }, { last_name: "asc" }, { first_name: "asc" }],
      take: 2000
    })
  ]);
  const ids = users.map((u) => u.id);
  const links = ids.length
    ? await prisma.kpiGroupAgent.findMany({
        where: { user_id: { in: ids }, kpi_group_id: { in: groups.map((g) => g.id) } },
        select: { user_id: true, kpi_group_id: true }
      })
    : [];
  const linked = new Map<number, number[]>();
  for (const l of links) {
    const arr = linked.get(l.user_id) ?? [];
    arr.push(l.kpi_group_id);
    linked.set(l.user_id, arr);
  }
  const used = new Set(links.map((l) => l.kpi_group_id));
  const cols = groups.filter((g) => used.has(g.id));
  const [emps, monthRows] = await Promise.all([
    prisma.payrollEmployeeConfig.findMany({ where: { tenant_id: tenantId, user_id: { in: ids } }, select: { user_id: true, item_amounts: true } }),
    snaps(tenantId)
  ]);
  const live = new Map(emps.map((e) => [e.user_id, e.item_amounts]));
  const ym = ymKey(year, month);
  return {
    groups: cols.map((g) => ({ id: g.id, name: g.name })),
    people: users.map((u) => {
      const snap = monthRows.filter((r) => r.scope === "user" && r.user_id === u.id && r.ym <= ym).sort((a, b) => b.ym - a.ym)[0];
      const amounts = parseKpiAmounts(snap?.raw ?? live.get(u.id));
      return {
        user_id: u.id,
        first_name: u.first_name || u.name || "",
        last_name: u.last_name || "",
        code: u.code,
        role: u.role,
        branch: u.branch,
        trade_direction: u.trade_direction,
        kpi_ids: linked.get(u.id) ?? [],
        amounts
      };
    })
  };
}

export async function savePayrollKpiAmounts(
  tenantId: number,
  year: number,
  month: number,
  rows: Array<{ user_id: number; amounts: Record<string, number | null> }>
) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  if (period?.status === "closed") throw new PayrollError("PERIOD_CLOSED");
  let saved = 0;
  for (const row of rows) {
    const user = await prisma.user.findFirst({ where: { id: row.user_id, tenant_id: tenantId }, select: { id: true, role: true } });
    if (!user) continue;
    const links = await prisma.kpiGroupAgent.findMany({ where: { user_id: user.id }, select: { kpi_group_id: true } });
    const allowed = new Set(links.map((l) => l.kpi_group_id));
    const patch: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(row.amounts)) if (allowed.has(Number(k))) patch[k] = v;
    if (!Object.keys(patch).length) continue;
    const emp = await prisma.payrollEmployeeConfig.findUnique({ where: { tenant_id_user_id: { tenant_id: tenantId, user_id: user.id } } });
    const monthRows = await snaps(tenantId);
    const prev = monthRows.filter((r) => r.scope === "user" && r.user_id === user.id && r.ym <= ymKey(year, month)).sort((a, b) => b.ym - a.ym)[0];
    const merged = mergeKpiAmounts(prev?.raw ?? emp?.item_amounts, patch);
    if (emp) {
      await prisma.payrollEmployeeConfig.update({ where: { id: emp.id }, data: { item_amounts: merged as object } });
    } else {
      await prisma.payrollEmployeeConfig.create({ data: { tenant_id: tenantId, user_id: user.id, item_amounts: merged as object } });
    }
    await writeSnap(tenantId, year, month, "user", user.role, user.id, emp?.base_amount == null ? null : Number(emp.base_amount), merged);
    saved++;
  }
  if (saved) void markPayrollDirtyForTenant(tenantId, "kpi-grid");
  return { saved };
}
