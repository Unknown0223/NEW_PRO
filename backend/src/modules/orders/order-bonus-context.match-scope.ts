import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { bonusGiftSelectionMeta } from "./bonus-gift-selection";
import type { OrderAgentBonusContext, ProductLite } from "./order-bonus-context.fetch";
import { ruleMatchesClient, ruleNeedsOrderContext } from "./order-bonus-context.fetch";

function normBonusBranch(s: string): string {
  return String(s).trim().toLowerCase();
}

/**
 * Bo‘sh ro‘yxatlar = o‘sha o‘q bo‘yicha cheklov yo‘q.
 * Filial + aniq agentlar bir vaqtda: OR (filialdagi yoki ro‘yxatdagi agent).
 * Savdo yo‘nalishi: AND (tanlangan bo‘lsa, `trade_direction_id` mos kelishi kerak).
 */
export function ruleMatchesOrderAgentScope(
  rule: BonusRuleRow,
  agent: OrderAgentBonusContext | null
): boolean {
  const branches = rule.scope_branch_codes ?? [];
  const agentIds = rule.scope_agent_user_ids ?? [];
  const dirIds = rule.scope_trade_direction_ids ?? [];

  const hasBranch = branches.length > 0;
  const hasAgents = agentIds.length > 0;
  const hasDirs = dirIds.length > 0;

  if (!hasBranch && !hasAgents && !hasDirs) return true;

  if (agent == null) return false;

  if (hasBranch || hasAgents) {
    const branchSet = new Set(branches.map(normBonusBranch));
    const branchOk =
      hasBranch && agent.branch != null && branchSet.has(normBonusBranch(agent.branch));
    const agentOk = hasAgents && agentIds.includes(agent.userId);

    if (hasBranch && hasAgents) {
      if (!(branchOk || agentOk)) return false;
    } else if (hasBranch && !branchOk) return false;
    else if (hasAgents && !agentOk) return false;
  }

  if (hasDirs) {
    if (agent.trade_direction_id == null || !dirIds.includes(agent.trade_direction_id)) {
      return false;
    }
  }
  return true;
}

/** Zakazdagi mahsulotlar to‘plami qoida filtriga mos keladimi. */
export function ruleMatchesOrderProductScope(
  rule: BonusRuleRow,
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>
): boolean {
  if (rule.product_ids.length > 0) {
    if (!rule.product_ids.some((id) => orderedProductIds.has(id))) {
      return false;
    }
  }
  if (rule.product_category_ids.length > 0) {
    let ok = false;
    for (const pid of orderedProductIds) {
      const p = productById.get(pid);
      if (p?.category_id != null && rule.product_category_ids.includes(p.category_id)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

/** Sotib olish doirasi: mahsulot yoki kategoriya tanlangan bo‘lsa — har SKU alohida; bo‘shsa — zakaz bo‘yicha umumiy miqdor. */
export function ruleHasPurchaseScope(rule: BonusRuleRow): boolean {
  return rule.product_ids.length > 0 || rule.product_category_ids.length > 0;
}

function productMatchesQtyRuleScope(rule: BonusRuleRow, product: ProductLite): boolean {
  if (rule.product_ids.length > 0 && !rule.product_ids.includes(product.id)) {
    return false;
  }
  if (rule.product_category_ids.length > 0) {
    if (product.category_id == null || !rule.product_category_ids.includes(product.category_id)) {
      return false;
    }
  }
  return true;
}

/** Qty qoida doirasi bo‘yicha zakazdagi har bir mos SKU (sotib olingan miqdor > 0). */
export function qtyRuleMatchingProductIds(
  rule: BonusRuleRow,
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>
): number[] {
  const out: number[] = [];
  for (const [pid, q] of qtyByProduct) {
    if (q <= 0) continue;
    const product = productById.get(pid);
    if (!product || !productMatchesQtyRuleScope(rule, product)) continue;
    out.push(pid);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Qty qoida doirasi bo‘yicha zakazdagi mos qatorlar miqdorini yig‘adi.
 * `heroProductId` — eng ko‘p sotilgan mos SKU (prereq / umumiy kontekst uchun).
 */
export function sumMatchingOrderQtyForQtyRule(
  rule: BonusRuleRow,
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>
): { totalQty: number; heroProductId: number } {
  let totalQty = 0;
  let heroProductId = 0;
  let heroQ = 0;

  for (const [pid, q] of qtyByProduct) {
    if (q <= 0) continue;
    const product = productById.get(pid);
    if (!product || !productMatchesQtyRuleScope(rule, product)) continue;
    totalQty += q;
    if (q > heroQ) {
      heroQ = q;
      heroProductId = pid;
    }
  }

  return { totalQty, heroProductId };
}

/**
 * Zakazdagi tanlangan mahsulotlar bilan qoida bog‘langanligi.
 * Sotib olish doirasi bo‘lsa — `ruleMatchesOrderProductScope` yetarli.
 * Doira bo‘lmasa — zakazda qoida SKU/kategoriyasi (yoki sovg‘a SKU kategoriyasi) bo‘lishi kerak;
 * aks holda faqat umumiy `min_sum` / umumiy miqdor bo‘yicha begona sovg‘a chiqmaydi.
 */
export function ruleRelatesToOrderSelection(
  rule: BonusRuleRow,
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>
): boolean {
  if (!ruleMatchesOrderProductScope(rule, orderedProductIds, productById)) {
    return false;
  }
  if (ruleHasPurchaseScope(rule)) {
    return true;
  }

  const hasProductLink =
    rule.product_ids.length > 0 ||
    rule.bonus_product_ids.length > 0 ||
    rule.product_category_ids.length > 0;
  if (!hasProductLink) {
    return true;
  }

  for (const id of rule.product_ids) {
    if (orderedProductIds.has(id)) return true;
  }
  for (const id of rule.bonus_product_ids) {
    if (orderedProductIds.has(id)) return true;
  }
  if (rule.product_category_ids.length > 0) {
    for (const pid of orderedProductIds) {
      const p = productById.get(pid);
      if (p?.category_id != null && rule.product_category_ids.includes(p.category_id)) {
        return true;
      }
    }
    return false;
  }

  for (const bid of rule.bonus_product_ids) {
    const bp = productById.get(bid);
    if (!bp?.category_id) continue;
    for (const pid of orderedProductIds) {
      const op = productById.get(pid);
      if (op?.category_id === bp.category_id) return true;
    }
  }

  return false;
}

/** Umumiy miqdor (asortimentsiz qty) peeklarida `purchasedPid` o‘rniga. */
export const QTY_AGGREGATE_PURCHASED_PID = 0;

export type QtyGiftResolveContext = {
  /**
   * Bonus tanlash uchun mavjud qoldiq.
   * Create path: ombor (qty−reserved) minus savatdagi pullik dona — aks holda
   * «omborda ko‘p, lekin hammasi pullik» SKU tanlanib, keyin bonus 0 bo‘ladi.
   */
  availableByProductId?: ReadonlyMap<number, number>;
  /** Kamida shuncha dona chiqarish mumkin bo‘lishi kerak */
  minUnits?: number;
  /** `category_stock` qoidalari uchun: kategoriya ichidagi nomzod sovg‘a SKU’lar (ombor ustuvorligi bilan tanlanadi). */
  categoryCandidateIds?: number[];
};

/**
 * Sovg‘a tanlash uchun: ombor qoldig‘idan pullik savatni ayirish.
 * Natija = bonus uchun bo‘sh joy (stock-cap bilan bir xil mantiq).
 */
export function bonusRoomAfterPaidQty(
  warehouseAvailable: ReadonlyMap<number, number>,
  paidQtyByProduct: ReadonlyMap<number, number>
): Map<number, number> {
  const out = new Map<number, number>();
  const ids = new Set<number>([...warehouseAvailable.keys(), ...paidQtyByProduct.keys()]);
  for (const id of ids) {
    if (id <= 0) continue;
    const avail = warehouseAvailable.get(id) ?? 0;
    const paid = paidQtyByProduct.get(id) ?? 0;
    out.set(id, Math.max(0, avail - paid));
  }
  return out;
}

export function pickGiftFromAllowedList(
  allowed: number[],
  purchasedPid: number,
  avail: ReadonlyMap<number, number> | undefined,
  minUnits: number
): number {
  if (allowed.length === 0) return purchasedPid > 0 ? purchasedPid : 0;

  const canServe = (pid: number) => (avail?.get(pid) ?? Number.POSITIVE_INFINITY) >= minUnits;

  if (purchasedPid > 0 && allowed.includes(purchasedPid)) {
    if (avail == null || canServe(purchasedPid)) return purchasedPid;
  }

  if (avail != null && allowed.length > 1) {
    const sorted = [...allowed].sort((a, b) => (avail.get(b) ?? 0) - (avail.get(a) ?? 0));
    for (const pid of sorted) {
      if (canServe(pid)) return pid;
    }
    return sorted[0]!;
  }

  return allowed[0]!;
}

/**
 * Qty bonus sovg‘a mahsuloti:
 * - `bonus_product_ids` bo‘sh → `purchasedPid` (trigger qatori / agregatda eng ko‘p sotilgan SKU).
 * - Ro‘yxat bor → avvalo **shu qatordagi** mahsulot ro‘yxatda bo‘lsa va omborda yetarli bo‘lsa shu;
 *   aks holda ro‘yxatdan **eng ko‘p qoldiq** bo‘yicha (mijoz «boshqa razmer» holati).
 */
export function resolveQtyGiftProductId(
  rule: BonusRuleRow,
  purchasedPid: number,
  giftOverrides: ReadonlyMap<number, number>,
  ctx?: QtyGiftResolveContext
): number {
  const allowed = rule.bonus_product_ids;
  const minUnits = Math.max(1, ctx?.minUnits ?? 1);
  const avail = ctx?.availableByProductId;
  const categoryCandidateIds = ctx?.categoryCandidateIds ?? [];

  /** 5+1 assortiment: sovg‘a — xarid qilingan SKU; ombor qoldig‘i alohida tekshirilmaydi. */
  const selectionMeta = bonusGiftSelectionMeta(
    rule,
    allowed.length > 0 ? allowed.length : Math.max(1, purchasedPid > 0 ? 1 : 0)
  );
  if (selectionMeta.kind === "assortment_auto" && purchasedPid > 0) {
    return purchasedPid;
  }

  const override = giftOverrides.get(rule.id);
  if (override !== undefined && Number.isFinite(override) && override > 0) {
    if (allowed.length > 0) {
      if (allowed.includes(override)) return override;
    } else if (selectionMeta.kind === "category_stock") {
      if (categoryCandidateIds.includes(override)) return override;
    } else if (purchasedPid > 0 && override === purchasedPid) {
      return override;
    }
  }

  /** Faqat kategoriya (aniq sovg‘a SKU yo‘q): xarid qilingan mahsulotdan qat’i nazar, omborda eng ko‘p qoldiqli mahsulotdan. */
  if (selectionMeta.kind === "category_stock") {
    if (categoryCandidateIds.length === 0) {
      return purchasedPid > 0 ? purchasedPid : 0;
    }
    return pickGiftFromAllowedList(categoryCandidateIds, 0, avail, minUnits);
  }

  if (allowed.length === 0) {
    return purchasedPid > 0 ? purchasedPid : 0;
  }

  const linePid =
    purchasedPid === QTY_AGGREGATE_PURCHASED_PID || purchasedPid <= 0 ? -1 : purchasedPid;

  return pickGiftFromAllowedList(allowed, linePid, avail, minUnits);
}
