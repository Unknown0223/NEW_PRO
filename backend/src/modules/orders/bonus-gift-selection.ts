import { prisma } from "../../config/database";
import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";

export type BonusGiftSelectionKind = "fixed" | "pick_product" | "assortment_auto";

/** Mobil preview va zakaz validatsiyasi: qaysi mahsulotlar sovg‘a bo‘lishi mumkin. */
export async function resolveAllowedGiftProductIdsForRule(
  tenantId: number,
  rule: BonusRuleRow,
  fallbackGiftPid?: number
): Promise<number[]> {
  if (rule.bonus_product_ids.length > 0) {
    const bonusIds = [...new Set(rule.bonus_product_ids)].filter((id) => id > 0);
    const meta = bonusGiftSelectionMeta(rule, bonusIds.length);
    if (meta.kind === "assortment_auto" && fallbackGiftPid != null && fallbackGiftPid > 0) {
      return [fallbackGiftPid];
    }
    return bonusIds;
  }
  const triggerIds = rule.product_ids.length > 0 ? [...new Set(rule.product_ids)].filter((id) => id > 0) : [];
  const meta = bonusGiftSelectionMeta(rule, triggerIds.length);
  if (meta.kind === "assortment_auto" && fallbackGiftPid != null && fallbackGiftPid > 0) {
    return [fallbackGiftPid];
  }
  if (triggerIds.length > 0) {
    return triggerIds;
  }
  if (rule.product_category_ids.length > 0) {
    const rows = await prisma.product.findMany({
      where: {
        tenant_id: tenantId,
        category_id: { in: rule.product_category_ids },
        is_blocked: false
      },
      select: { id: true },
      orderBy: { name: "asc" }
    });
    return rows.map((p) => p.id).filter((id) => id > 0);
  }
  if (fallbackGiftPid != null && fallbackGiftPid > 0) return [fallbackGiftPid];
  return [];
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

  if (hasCategoryScope && bonusIds.length === 0) {
    return { kind: "assortment_auto", allow_gift_swap: false };
  }
  if (giftProductCount > 1 && bonusIds.length === 0) {
    return { kind: "assortment_auto", allow_gift_swap: false };
  }
  return { kind: "fixed", allow_gift_swap: false };
}
