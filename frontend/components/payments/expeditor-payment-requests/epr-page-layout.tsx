"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Shablon: tema kanvasi (`.app-main-canvas`) ko‘rinishi uchun shaffof; ixcham padding. */
export function EprPageLayout({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 bg-transparent text-foreground", className)}>
      <div className="space-y-4 px-3 py-3 pb-20 sm:px-4 md:px-6">{children}</div>
    </div>
  );
}
