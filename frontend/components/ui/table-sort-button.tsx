"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableSortDir = "asc" | "desc";

type Props = {
  label: ReactNode;
  active: boolean;
  dir: TableSortDir;
  onClick: () => void;
  title?: string;
  className?: string;
  align?: "left" | "center";
};

/** Sarlavha ichida: bosilganda tartib, strelka holati. */
export function TableSortButton({ label, active, dir, onClick, title = "Сортировка", className, align = "left" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-0.5 rounded px-0.5 py-0.5 hover:bg-muted/50 hover:text-foreground",
        align === "center" ? "w-full justify-center text-center" : "text-left",
        className
      )}
    >
      <span className="min-w-0 shrink leading-tight">{label}</span>
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-45" aria-hidden />
      )}
    </button>
  );
}
