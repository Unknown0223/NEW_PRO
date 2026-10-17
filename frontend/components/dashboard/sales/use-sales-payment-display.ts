"use client";

import { formatPaymentTypeLabel } from "@/components/dashboard/sales/format";
import { useMemo } from "react";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

export function useSalesPaymentDisplay(
  paymentEntries: Array<{ id: string; name: string; code?: string | null }> | undefined
) {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const p of paymentEntries ?? []) {
      const id = normTrim(String(p.id ?? ""));
      const name = normTrim(String(p.name ?? ""));
      const code = normTrim(String(p.code ?? ""));
      if (!name && !id) continue;
      const label = name || id;
      if (id) {
        m.set(id, label);
        m.set(id.toLowerCase(), label);
      }
      if (code) {
        m.set(code, label);
        m.set(code.toLowerCase(), label);
      }
      if (name) {
        m.set(name, label);
        m.set(name.toLowerCase(), label);
      }
    }
    return (ref: string) => {
      const k = normTrim(ref);
      if (!k || k === "—") return "—";
      return m.get(k) ?? m.get(k.toLowerCase()) ?? formatPaymentTypeLabel(k);
    };
  }, [paymentEntries]);
}
