import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import {
  getAllowedNextStatuses,
  isOperatorLateStageCancelForbidden
} from "../order-status";
import type {
  BonusGiftOverrideInput,
  BonusGiftSwapOptionRow
} from "./order.types";

export function roundOrderMoney(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function parseBonusGiftSelectionsJson(json: Prisma.JsonValue | null | undefined): Map<number, number> {
  const m = new Map<number, number>();
  if (json == null || typeof json !== "object" || Array.isArray(json)) return m;
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    const rid = Number.parseInt(k, 10);
    const pid = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(rid) && rid > 0 && Number.isFinite(pid) && pid > 0) m.set(rid, pid);
  }
  return m;
}

export function bonusGiftMapToJson(map: Map<number, number>): Prisma.InputJsonValue {
  const o: Record<string, number> = {};
  for (const [k, v] of map) o[String(k)] = v;
  return o;
}

export async function validateBonusGiftOverrides(
  tenantId: number,
  rows: BonusGiftOverrideInput[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const row of rows) {
    const rule = await prisma.bonusRule.findFirst({
      where: {
        id: row.bonus_rule_id,
        tenant_id: tenantId,
        type: "qty",
        is_manual: false,
        is_active: true
      },
      select: { id: true, bonus_product_ids: true }
    });
    if (!rule) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    const ids = rule.bonus_product_ids;
    if (ids.length === 0 || !ids.includes(row.bonus_product_id)) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    map.set(row.bonus_rule_id, row.bonus_product_id);
  }
  return map;
}

export async function buildBonusGiftSwapOptions(
  tenantId: number,
  appliedRuleIds: number[],
  selections: Map<number, number>
): Promise<BonusGiftSwapOptionRow[]> {
  const out: BonusGiftSwapOptionRow[] = [];
  if (!appliedRuleIds.length) return out;
  const rules = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: appliedRuleIds }, type: "qty" },
    select: { id: true, name: true, bonus_product_ids: true }
  });
  const productIdSet = new Set<number>();
  for (const r of rules) {
    if (r.bonus_product_ids.length < 2) continue;
    for (const pid of r.bonus_product_ids) productIdSet.add(pid);
  }
  if (productIdSet.size === 0) return out;
  const products = await prisma.product.findMany({
    where: { id: { in: [...productIdSet] }, tenant_id: tenantId },
    select: { id: true, name: true, sku: true }
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  for (const r of rules) {
    if (r.bonus_product_ids.length < 2) continue;
    const chosen = selections.get(r.id) ?? r.bonus_product_ids[0]!;
    out.push({
      bonus_rule_id: r.id,
      rule_name: r.name,
      allowed_product_ids: [...r.bonus_product_ids],
      chosen_product_id: chosen,
      products: r.bonus_product_ids.map((id) => {
        const p = pmap.get(id);
        return { id, name: p?.name ?? `#${id}`, sku: p?.sku ?? "" };
      })
    });
  }
  return out;
}

export function sumBonusQty(
  items: ReadonlyArray<{ qty: Prisma.Decimal; is_bonus: boolean }>
): string {
  return items
    .filter((i) => i.is_bonus)
    .reduce((acc, i) => acc.add(i.qty), new Prisma.Decimal(0))
    .toString();
}

export function allowedNextForRole(status: string, viewerRole: string | undefined): string[] {
  if (status === "cancelled" && viewerRole !== "admin") {
    return [];
  }
  if (viewerRole === "operator") {
    return getAllowedNextStatuses(status, { omitBackward: true }).filter(
      (s) => !isOperatorLateStageCancelForbidden(status, s)
    );
  }
  return getAllowedNextStatuses(status);
}
