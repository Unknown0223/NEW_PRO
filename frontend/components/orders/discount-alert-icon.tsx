import { discountAlertLabel } from "@/lib/discount-alert";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function DiscountAlertIcon({
  code,
  className,
  size = 16
}: {
  code: string | null | undefined;
  className?: string;
  size?: number;
}) {
  if (!code) return null;
  const title = discountAlertLabel(code);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      title={title ?? undefined}
      aria-label={title ?? "Проблема со скидкой"}
    >
      <AlertTriangle className="text-amber-500" style={{ width: size, height: size }} />
    </span>
  );
}
