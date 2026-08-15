import { bonusAlertLabel } from "@/lib/bonus-alert";
import { discountAlertLabel } from "@/lib/discount-alert";

/** Berilmagan / muammoli skidka yoki bonus — bitta belgi uchun. */
export function orderHasPromoAlert(
  discountAlert: string | null | undefined,
  bonusAlert: string | null | undefined
): boolean {
  return Boolean((discountAlert ?? "").trim() || (bonusAlert ?? "").trim());
}

/** Tooltip / aria: skidka + bonus matnlari. */
export function orderPromoAlertTitle(
  discountAlert: string | null | undefined,
  bonusAlert: string | null | undefined
): string | null {
  const parts: string[] = [];
  const d = discountAlertLabel(discountAlert);
  const b = bonusAlertLabel(bonusAlert);
  if (d) parts.push(d);
  if (b) parts.push(b);
  return parts.length > 0 ? parts.join(" · ") : null;
}
