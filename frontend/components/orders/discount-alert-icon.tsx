import { orderHasPromoAlert, orderPromoAlertTitle } from "@/lib/order-alert";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

/** Berilmagan skidka va/yoki bonus uchun bitta amber belgi. */
export function OrderPromoAlertIcon({
  discountAlert,
  bonusAlert,
  className,
  size = 16
}: {
  discountAlert?: string | null;
  bonusAlert?: string | null;
  className?: string;
  size?: number;
}) {
  if (!orderHasPromoAlert(discountAlert, bonusAlert)) return null;
  const title = orderPromoAlertTitle(discountAlert, bonusAlert);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      title={title ?? undefined}
      aria-label={title ?? "Проблема со скидкой или бонусом"}
    >
      <AlertTriangle className="text-amber-500" style={{ width: size, height: size }} />
    </span>
  );
}

/** @deprecated Use OrderPromoAlertIcon — kept for discount-only call sites. */
export function DiscountAlertIcon({
  code,
  className,
  size = 16
}: {
  code: string | null | undefined;
  className?: string;
  size?: number;
}) {
  return (
    <OrderPromoAlertIcon discountAlert={code} bonusAlert={null} className={className} size={size} />
  );
}
