"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { HttpStatusScreen } from "@/components/errors/http-status-screen";

type AccessDeniedBannerProps = {
  title?: string;
  message?: string;
  /** Compact — login / inline banner (eski card). */
  compact?: boolean;
  className?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** To‘liq 403 sahifa uchun bo‘lim nomi. */
  resource?: string;
};

const DEFAULT_TITLE = "Доступ ограничен";
const DEFAULT_MESSAGE =
  "Вы на верном пути, но эта дверь пока закрыта. Для просмотра раздела нужны дополнительные права.";

/**
 * Deep-link / ruxsatsiz sahifa — to‘liq ErrorPage 403.
 * `compact` — login va kichik bannerlar uchun eski card.
 */
export function AccessDeniedBanner({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  compact = false,
  className,
  primaryHref = "/dashboard",
  primaryLabel = "На главную",
  secondaryHref,
  secondaryLabel,
  resource
}: AccessDeniedBannerProps) {
  if (!compact) {
    return (
      <HttpStatusScreen
        code={403}
        title={title}
        message={message}
        resource={resource}
        homePath={primaryHref}
        onRequestAccess={
          secondaryHref
            ? () => {
                window.location.assign(secondaryHref);
              }
            : undefined
        }
        className={className}
      />
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden border border-border/70 bg-card text-card-foreground shadow-sm",
        "bg-[linear-gradient(165deg,oklch(0.99_0.01_175)_0%,oklch(0.97_0.02_188)_45%,oklch(0.98_0.01_200)_100%)]",
        "rounded-xl px-4 py-3.5",
        className
      )}
    >
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
          <ShieldOff className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{message}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={primaryHref} className={cn(buttonVariants({ size: "sm" }), "min-w-[9rem]")}>
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
