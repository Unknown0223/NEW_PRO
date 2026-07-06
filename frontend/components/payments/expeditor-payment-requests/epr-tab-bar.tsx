"use client";

import { cn } from "@/lib/utils";
import type { SourceTab } from "./expeditor-payment-requests-types";

const TABS: { key: SourceTab; label: string }[] = [
  { key: "expeditor", label: "Экспедиторы" },
  { key: "collector", label: "Инкассатор" },
  { key: "van", label: "Van-selling" },
  { key: "bank", label: "Банковские оплаты" }
];

type Props = {
  active: SourceTab;
  onChange: (tab: SourceTab) => void;
};

export function EprTabBar({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition",
            active === t.key
              ? "bg-[#063b36] text-white shadow"
              : "text-slate-600 hover:bg-muted"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
