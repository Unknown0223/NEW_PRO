"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function InfoValueBox({
  children,
  className,
  align = "end"
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-1.5 text-sm",
        align === "end" && "text-right",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InfoRow({
  icon: Icon,
  label,
  children,
  className,
  span2
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  className?: string;
  span2?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        span2 && "sm:col-span-2",
        className
      )}
    >
      <Icon className="size-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
      <span className="w-[7.5rem] shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

export function OrderDetailCard({
  title,
  children,
  action,
  className
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
