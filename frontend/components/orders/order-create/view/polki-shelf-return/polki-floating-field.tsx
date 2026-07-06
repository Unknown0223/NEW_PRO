"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Эталон: material-style label над полем на белом фоне. */
export function PolkiFloatingField({
  label,
  htmlFor,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <label
        htmlFor={htmlFor}
        className="pointer-events-none absolute left-3 top-[-8px] z-[1] bg-card px-1.5 text-xs text-slate-500"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
