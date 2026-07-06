import { prisma } from "../../config/database";
import { parseAppliedBonusRulesSnapshot } from "../bonus-rules/bonus-rules.snapshot";

function discountPctFromSnapshot(raw: unknown): number[] {
  const snapshot = parseAppliedBonusRulesSnapshot(raw);
  const pcts = new Set<number>();
  for (const r of snapshot) {
    if ((r.type === "discount" || r.type === "sum") && r.discount_pct != null && r.discount_pct > 0) {
      pcts.add(r.discount_pct);
    }
  }
  return [...pcts].sort((a, b) => a - b);
}

function formatPctList(pcts: number[]): string {
  if (pcts.length === 0) return "—";
  if (pcts.length === 1) return `${pcts[0]}%`;
  return pcts.map((p) => `${p}%`).join(", ");
}

/**
 * Skidka to‘lovi (`discount_settlement`) uchun avtomatik izoh:
 * shartga mos zakazlar ID/raqami va qo‘llangan foiz.
 */
export async function buildDiscountSettlementNote(
  tenantId: number,
  clientId: number,
  opts?: {
    order_id?: number | null;
    allocation_order_ids?: number[];
  }
): Promise<string> {
  const explicitIds = [
    ...(opts?.order_id != null && opts.order_id > 0 ? [opts.order_id] : []),
    ...(opts?.allocation_order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0)
  ];
  const uniqueExplicit = [...new Set(explicitIds)];

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      discount_sum: { gt: 0 },
      ...(uniqueExplicit.length > 0 ? { id: { in: uniqueExplicit } } : {})
    },
    select: {
      id: true,
      number: true,
      discount_sum: true,
      applied_bonus_rules_snapshot: true
    },
    orderBy: { id: "desc" },
    take: uniqueExplicit.length > 0 ? uniqueExplicit.length : 30
  });

  if (orders.length === 0) return "";

  if (orders.length === 1) {
    const o = orders[0]!;
    const pcts = discountPctFromSnapshot(o.applied_bonus_rules_snapshot);
    return `Заказ #${o.number} — скидка ${formatPctList(pcts)}`;
  }

  const allPcts = new Set<number>();
  for (const o of orders) {
    for (const p of discountPctFromSnapshot(o.applied_bonus_rules_snapshot)) {
      allPcts.add(p);
    }
  }
  const ids = orders.map((o) => `#${o.number}`).join(", ");
  const pctStr = formatPctList([...allPcts].sort((a, b) => a - b));
  return `Заказы ${ids} — скидка ${pctStr}`;
}
