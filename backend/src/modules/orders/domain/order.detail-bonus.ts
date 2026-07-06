import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { moneyFrom, roundMoney, type Money } from "../../../domain/money";
import { mapBonusRuleFull } from "../../bonus-rules/bonus-rules.mappers";
import { bonusRuleInclude } from "../../bonus-rules/bonus-rules.types";
import { resolveAllowedGiftProductIdsForRule } from "../bonus-gift-selection";
import {
  getAllowedNextStatuses,
  isOperatorLateStageCancelForbidden,
  normalizeOrderType
} from "../order-status";
import type {
  BonusGiftOverrideInput,
  BonusGiftLineInput,
  BonusGiftSwapOptionRow
} from "./order.types";

export function roundOrderMoney(d: Prisma.Decimal): Money {
  return roundMoney(moneyFrom(d));
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
    const ruleRaw = await prisma.bonusRule.findFirst({
      where: {
        id: row.bonus_rule_id,
        tenant_id: tenantId,
        type: "qty",
        is_manual: false,
        is_active: true
      },
      include: bonusRuleInclude
    });
    if (!ruleRaw) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    const rule = mapBonusRuleFull(ruleRaw);
    const allowed = await resolveAllowedGiftProductIdsForRule(tenantId, rule);
    if (allowed.length === 0 || !allowed.includes(row.bonus_product_id)) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    map.set(row.bonus_rule_id, row.bonus_product_id);
  }
  return map;
}

/** Bir qoida uchun bir nechta sovg‘a mahsuloti/dona (mobil tanlov). */
export async function validateBonusGiftLines(
  tenantId: number,
  rows: BonusGiftLineInput[]
): Promise<Map<number, Map<number, number>>> {
  const byRule = new Map<number, Map<number, number>>();
  for (const row of rows) {
    const qty = Number(row.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    let ruleMap = byRule.get(row.bonus_rule_id);
    if (!ruleMap) {
      ruleMap = new Map<number, number>();
      byRule.set(row.bonus_rule_id, ruleMap);
    }
    const prev = ruleMap.get(row.product_id) ?? 0;
    ruleMap.set(row.product_id, prev + qty);
  }

  for (const [ruleId, lines] of byRule) {
    const ruleRaw = await prisma.bonusRule.findFirst({
      where: {
        id: ruleId,
        tenant_id: tenantId,
        type: "qty",
        is_manual: false,
        is_active: true
      },
      include: bonusRuleInclude
    });
    if (!ruleRaw) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    const rule = mapBonusRuleFull(ruleRaw);
    const allowed = await resolveAllowedGiftProductIdsForRule(tenantId, rule);
    if (allowed.length === 0) {
      throw new Error("BAD_BONUS_GIFT_OVERRIDE");
    }
    const allowedSet = new Set(allowed);
    for (const [pid, q] of lines) {
      if (!allowedSet.has(pid) || q <= 0) {
        throw new Error("BAD_BONUS_GIFT_OVERRIDE");
      }
    }
  }

  return byRule;
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

export function allowedNextForRole(
  status: string,
  viewerRole: string | undefined,
  orderType?: string
): string[] {
  const type = normalizeOrderType(orderType);
  if (status === "cancelled") {
    return ["new"];
  }
  if (viewerRole === "operator") {
    return getAllowedNextStatuses(status, { omitBackward: false, orderType: type }).filter(
      (s) => !isOperatorLateStageCancelForbidden(status, s)
    );
  }
  return getAllowedNextStatuses(status, { orderType: type });
}
