import { prisma } from "../../config/database";
import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { rewardRuleViews } from "./order-bonus-clauses";

/**
 * - `fixed`: bitta qat'iy sovg'a SKU.
 * - `pick_product`: 2+ sovg'a SKU — mijoz/agent tanlaydi (swap ruxsat etilgan).
 * - `assortment_auto`: trigger = sovg'a (assortiment bo'yicha); har trigger-mahsulot o'zining sovg'asiga qulflangan, almashtirib bo'lmaydi.
 * - `category_stock`: faqat kategoriya doirasi, aniq sovg'a SKU tanlanmagan — default ombor qoldig'i bo'yicha;
 *   2+ nomzod bo'lsa agent almashtirishi mumkin (`allow_gift_swap`).
 */
export type BonusGiftSelectionKind = "fixed" | "pick_product" | "assortment_auto" | "category_stock";

/** Kategoriya doirasidagi sovg'aga nomzod mahsulotlar (faol, bloklanmagan). */
export async function resolveCategoryGiftCandidateIds(
  tenantId: number,
  categoryIds: number[]
): Promise<number[]> {
  const ids = [...new Set(categoryIds)].filter((id) => id > 0);
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      tenant_id: tenantId,
      category_id: { in: ids },
      is_blocked: false
    },
    select: { id: true },
    orderBy: { name: "asc" }
  });
  return rows.map((p) => p.id).filter((id) => id > 0);
}

async function resolveAllowedGiftProductIdsForView(
  tenantId: number,
  rule: BonusRuleRow,
  fallbackGiftPid?: number
): Promise<number[]> {
  if (rule.bonus_product_ids.length > 0) {
    const bonusIds = [...new Set(rule.bonus_product_ids)].filter((id) => id > 0);
    const meta = bonusGiftSelectionMeta(rule, bonusIds.length);
    if (meta.kind === "assortment_auto" && fallbackGiftPid != null && fallbackGiftPid > 0) {
      // Faqat ro‘yxatdagi SKU ga toraytirish — tashqaridagi fallback allowed qilmasin.
      return bonusIds.includes(fallbackGiftPid) ? [fallbackGiftPid] : bonusIds;
    }
    return bonusIds;
  }
  const triggerIds = rule.product_ids.length > 0 ? [...new Set(rule.product_ids)].filter((id) => id > 0) : [];
  const meta = bonusGiftSelectionMeta(rule, triggerIds.length);
  if (meta.kind === "assortment_auto" && fallbackGiftPid != null && fallbackGiftPid > 0) {
    if (triggerIds.length > 0) {
      return triggerIds.includes(fallbackGiftPid) ? [fallbackGiftPid] : triggerIds;
    }
    // Cheklovsiz global: preview kontekstida tanlangan sovg‘a.
    return [fallbackGiftPid];
  }
  if (triggerIds.length > 0) {
    return triggerIds;
  }
  if (rule.product_category_ids.length > 0) {
    // To‘liq kategoriya havzasi — fallback bilan 1 SKU ga toraytirmaymiz
    // (mobil/web swap va bonus-preview `gift_products` uchun kerak).
    return resolveCategoryGiftCandidateIds(tenantId, rule.product_category_ids);
  }
  if (fallbackGiftPid != null && fallbackGiftPid > 0) return [fallbackGiftPid];
  return [];
}

/** Mobil preview va zakaz validatsiyasi: qaysi mahsulotlar sovg‘a bo‘lishi mumkin (barcha reward clause). */
export async function resolveAllowedGiftProductIdsForRule(
  tenantId: number,
  rule: BonusRuleRow,
  fallbackGiftPid?: number
): Promise<number[]> {
  const views = rewardRuleViews(rule);
  if (views.length <= 1) {
    return resolveAllowedGiftProductIdsForView(tenantId, views[0] ?? rule, fallbackGiftPid);
  }
  const out = new Set<number>();
  for (const view of views) {
    for (const id of await resolveAllowedGiftProductIdsForView(tenantId, view, fallbackGiftPid)) {
      out.add(id);
    }
  }
  return [...out];
}

/**
 * Web `bonus-rule-form`:
 * - `onlyByAssortment && !onlyByCategory` → `bonus_product_ids` saqlanmaydi ([])
 * - `onlyByCategory` + 2+ bonus SKU → mijoz tanlaydi
 */
export function bonusGiftSelectionMeta(
  rule: BonusRuleRow,
  giftProductCount: number
): { kind: BonusGiftSelectionKind; allow_gift_swap: boolean } {
  const hasCategoryScope =
    rule.scope_restrict_category === true || rule.product_category_ids.length > 0;
  const hasTriggerProducts = rule.product_ids.length > 0;
  const bonusIds = rule.bonus_product_ids;
  const restrictAssortmentOnly =
    rule.scope_restrict_assortment === true && rule.scope_restrict_category !== true;

  /** Faqat assortiment (kategoriya yo‘q): bonus ro‘yxati bo‘sh yoki trigger bilan bir xil (eski ma’lumot). */
  const assortmentOnlyMode =
    restrictAssortmentOnly ||
    (hasTriggerProducts &&
      !hasCategoryScope &&
      (bonusIds.length === 0 ||
        (bonusIds.length > 0 && bonusIds.every((id) => rule.product_ids.includes(id)))));

  if (assortmentOnlyMode) {
    return { kind: "assortment_auto", allow_gift_swap: false };
  }

  if (bonusIds.length >= 2) {
    return { kind: "pick_product", allow_gift_swap: true };
  }
  if (bonusIds.length === 1) {
    return { kind: "fixed", allow_gift_swap: false };
  }

  /** Faqat kategoriya (aniq sovg'a SKU yo'q): default ombor ustuvorligi; 2+ nomzod → swap. */
  if (hasCategoryScope && bonusIds.length === 0) {
    return { kind: "category_stock", allow_gift_swap: giftProductCount >= 2 };
  }
  /**
   * Aniq sovg'a SKU yo'q (global qty yoki assoriment): sovg'a xarid qilingan
   * mahsulot(lar)dan avtomatik — UI dan override yuborilmasligi kerak.
   * Eski: faqat giftProductCount>1 da assortment_auto; 1 ta SKU bo'lsa noto'g'ri `fixed`
   * bo'lib, mobil BadBonusGiftOverride berardi (allowed=[]).
   */
  if (bonusIds.length === 0) {
    return { kind: "assortment_auto", allow_gift_swap: false };
  }
  return { kind: "fixed", allow_gift_swap: false };
}
