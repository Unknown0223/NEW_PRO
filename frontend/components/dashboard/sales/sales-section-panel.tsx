"use client";

import { cn } from "@/lib/utils";

export function SalesSectionPanel({
  children,
  className,
  title,
  subtitle,
  action
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("sales-dashboard-panel sales-motion-slide-up", className)}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function SalesIconBadge({
  icon: Icon,
  tone = "teal"
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "teal" | "green" | "blue" | "amber" | "red";
}) {
  const tones = {
    teal: "bg-teal-100 text-teal-700 ring-teal-200",
    green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    amber: "bg-amber-100 text-amber-700 ring-amber-200",
    red: "bg-red-100 text-red-700 ring-red-200"
  };
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1",
        tones[tone]
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
