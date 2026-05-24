import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  icon,
  iconClassName,
  title,
  subtitle,
  step,
  children,
  className,
  variant = "default"
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  subtitle?: string;
  step?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "nested";
}) {
  const isNested = variant === "nested";

  return (
    <section
      className={cn(
        isNested
          ? "rounded-lg border border-border/80 bg-muted/10 p-4"
          : "rounded-xl border border-border bg-card p-5 shadow-sm lg:p-6",
        className
      )}
    >
      
      <div className={cn("flex items-start gap-3", isNested ? "mb-3" : "mb-4")}>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {step ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {step}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
