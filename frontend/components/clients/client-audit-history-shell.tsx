"use client";

import type { ReactNode } from "react";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  timeline: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * true — profil ichida (full-height layout): aniq balandlik + ichki scroll.
   * false — alohida sahifa: tablitsa tabiiy balandlikda, sahifa scroll qiladi.
   */
  embedded?: boolean;
};

/** Шаблон App.tsx — GPS topbar + Timeline + jadval. */
export function ClientAuditHistoryShell({
  timeline,
  children,
  className,
  embedded = false
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col bg-slate-100",
        embedded && "client-audit-viewport min-h-0 flex-1 overflow-hidden",
        className
      )}
    >
      <header className="flex shrink-0 items-center justify-between bg-white px-6 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600">
            <CircleDot className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            GPS
          </span>
          <span className="hidden truncate text-[15px] text-slate-500 sm:inline">
            Нет избранные страницы
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">{timeline}</div>
      </header>
      <main
        className={cn(
          "min-w-0 p-5",
          embedded
            ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
            : "overflow-visible"
        )}
      >
        {children}
      </main>
    </div>
  );
}
