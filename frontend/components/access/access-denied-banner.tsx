"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccessDeniedBannerProps = {
  /** Asosiy sarlavha (RU/UZ). */
  title?: string;
  /** Tafsilot (RU/UZ). */
  message?: string;
  /** Compact — login / inline banner. */
  compact?: boolean;
  className?: string;
  /** Asosiy CTA (default: home). */
  primaryHref?: string;
  primaryLabel?: string;
  /** Ikkinchi CTA (ixtiyoriy). */
  secondaryHref?: string;
  secondaryLabel?: string;
};

const DEFAULT_TITLE = "Нет доступа / Ruxsat yo‘q";
const DEFAULT_MESSAGE =
  "Доступ к этому разделу отключён или недостаточно прав. Обратитесь к администратору. / Bu bo‘lim yopiq yoki ruxsat yetarli emas. Administratorga murojaat qiling.";

/**
 * Deep-link / ruxsatsiz sahifa / login denial — bir xil SalesArena soft surface.
 * (qizil “signal” emas: yumshoq card, ikonka, aniq CTA).
 */
export function AccessDeniedBanner({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  compact = false,
  className,
  primaryHref = "/",
  primaryLabel = "На главную / Bosh sahifa",
  secondaryHref,
  secondaryLabel
}: AccessDeniedBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden border border-border/70 bg-card text-card-foreground shadow-sm",
        "bg-[linear-gradient(165deg,oklch(0.99_0.01_175)_0%,oklch(0.97_0.02_188)_45%,oklch(0.98_0.01_200)_100%)]",
        compact ? "rounded-xl px-4 py-3.5" : "mx-auto max-w-lg rounded-2xl px-6 py-7 sm:px-8",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
      />
      <div className={cn("relative flex gap-3", compact ? "items-start" : "flex-col items-stretch sm:flex-row sm:items-start sm:gap-4")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary",
            compact ? "mt-0.5 h-9 w-9" : "h-11 w-11"
          )}
        >
          <ShieldOff className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn("font-semibold tracking-tight text-foreground", compact ? "text-sm" : "text-base")}>
            {title}
          </p>
          <p className={cn("leading-relaxed text-muted-foreground", compact ? "text-xs sm:text-sm" : "text-sm")}>
            {message}
          </p>
          {!compact ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" className="min-w-[9rem]">
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              {secondaryHref && secondaryLabel ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
