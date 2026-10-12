import { prisma } from "../../config/database";
import { schemeMatches, type SchemeSelector } from "./payroll.scheme-select.pure";
import { ymInt } from "./payroll.scheme.types";

function hasMoney(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "number" || typeof v === "string") return Number(v) > 0;
  if (typeof v === "object" && v && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber() > 0;
  }
  if (typeof v === "object" && !Array.isArray(v)) {
    return Object.values(v as Record<string, unknown>).some((n) => Number(n) > 0);
  }
  return false;
}

/** Shu oyda hisoblashga sabab borlar: formula, sxema yoki oklad. KPI bog'lanishi o'zi yetmaydi. */
export async function usersWithPaySetup(tenantId: number, year: number, month: number, userIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(userIds.filter((id) => id > 0))];
  const out = new Set<number>();
  if (!ids.length) return out;
  const ym = ymInt(year, month);
  const [assigned, roleFormulas, schemes, emps, roles, grids, users, kept] = await Promise.all([
    prisma.payrollBonusAssignment.findMany({
      where: { tenant_id: tenantId, year, month, user_id: { in: ids } },
      select: { user_id: true },
      distinct: ["user_id"]
    }),
    prisma.payrollFormula.findMany({
      where: { tenant_id: tenantId, is_active: true, NOT: { role: null }, OR: [{ year: null }, { year, month }] },
      select: { role: true }
    }),
    prisma.payrollScheme.findMany({
      where: { tenant_id: tenantId, is_active: true, valid_from: { lte: ym }, OR: [{ valid_to: null }, { valid_to: { gte: ym } }] },
      select: { id: true, roles: true, branches: true, trade_direction_ids: true, positions: true, valid_from: true, valid_to: true, is_active: true }
    }),
    prisma.payrollEmployeeConfig.findMany({
      where: { tenant_id: tenantId, user_id: { in: ids } },
      select: { user_id: true, base_amount: true, item_amounts: true }
    }),
    prisma.payrollRoleConfig.findMany({
      where: { tenant_id: tenantId },
      select: { role: true, base_amount: true, item_amounts: true }
    }),
    prisma.payrollGridMonth.findMany({
      where: { tenant_id: tenantId, OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
      select: { scope: true, role: true, user_id: true, year: true, month: true, base_amount: true, item_amounts: true }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: ids } },
      select: { id: true, role: true, branch: true, trade_direction_id: true, position: true }
    }),
    prisma.payrollRecord.findMany({
      where: {
        tenant_id: tenantId,
        year,
        month,
        user_id: { in: ids },
        OR: [
          { status: "confirmed" },
          { lines: { some: { OR: [{ source: "manual" }, { is_manual_override: true }, { NOT: { corr_key: "" } }] } } }
        ]
      },
      select: { user_id: true }
    })
  ]);
  for (const a of assigned) out.add(a.user_id);
  for (const k of kept) out.add(k.user_id);
  const formulaRoles = new Set(roleFormulas.map((f) => f.role).filter((r): r is string => Boolean(r)));
  const rolePay = new Set(roles.filter((r) => hasMoney(r.base_amount) || hasMoney(r.item_amounts)).map((r) => r.role));
  const empPay = new Set(emps.filter((e) => hasMoney(e.base_amount) || hasMoney(e.item_amounts)).map((e) => e.user_id));
  const userGrid = new Map<number, number>();
  const roleGrid = new Map<string, number>();
  for (const g of grids) {
    if (!hasMoney(g.base_amount) && !hasMoney(g.item_amounts)) continue;
    const key = g.year * 100 + g.month;
    if (g.scope === "user" && g.user_id) userGrid.set(g.user_id, Math.max(userGrid.get(g.user_id) ?? 0, key));
    else if (g.role) roleGrid.set(g.role, Math.max(roleGrid.get(g.role) ?? 0, key));
  }
  for (const u of users) {
    if (formulaRoles.has(u.role) || rolePay.has(u.role) || empPay.has(u.id) || userGrid.has(u.id) || roleGrid.has(u.role)) out.add(u.id);
    if (
      schemes.some((s) =>
        schemeMatches(s as SchemeSelector, { role: u.role, branch: u.branch, trade_direction_id: u.trade_direction_id, position: u.position }, ym)
      )
    ) {
      out.add(u.id);
    }
  }
  return out;
}

/** Formula ham, oklad ham yo'q bo'sh qoralama yozuvni olib tashlaydi. */
export async function dropUnconfiguredDrafts(tenantId: number, year: number, month: number, userIds: number[]): Promise<void> {
  if (!userIds.length) return;
  await prisma.payrollRecord.deleteMany({
    where: { tenant_id: tenantId, year, month, user_id: { in: userIds }, status: "draft", gross: 0 }
  });
}
