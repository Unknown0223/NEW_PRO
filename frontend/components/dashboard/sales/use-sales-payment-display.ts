"use client";

import { formatPaymentTypeLabel } from "@/components/dashboard/sales/format";
import { useMemo } from "react";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

export function useSalesPaymentDisplay(
  paymentEntries: Array<{ id: string; name: string }> | undefined
) {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const p of paymentEntries ?? []) {
      const id = normTrim(String(p.id ?? ""));
      const name = normTrim(String(p.name ?? ""));
      if (!id) continue;
      m.set(id, name || id);
      m.set(id.toLowerCase(), name || id);
    }
    return (ref: string) => {
      const k = normTrim(ref);
      if (!k || k === "—") return "—";
      return m.get(k) ?? m.get(k.toLowerCase()) ?? formatPaymentTypeLabel(k);
    };
  }, [paymentEntries]);
}
