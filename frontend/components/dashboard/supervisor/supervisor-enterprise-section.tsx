"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupervisorEnterpriseSection({
  title,
  subtitle,
  icon,
  iconClassName,
  expanded,
  onToggle,
  headerExtra,
  children
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconClassName: string;
  expanded: boolean;
  onToggle: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              iconClassName
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <span className="ml-1 shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      {expanded ? <div className="p-5">{children}</div> : null}
    </div>
  );
}
