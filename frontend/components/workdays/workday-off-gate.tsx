"use client";

import { useEffect, type ReactNode } from "react";
import { DAY_OFF_PATH } from "@/lib/api";
import { useWorkdayStatus } from "@/lib/workday-status";

/**
 * «Рабочие дни»da belgilanmagan kunda (admin’dan tashqari) dashboard ochilmaydi —
 * faqat `/day-off` ma’lumot sahifasi. Backend ham `403 WORKDAY_OFF` bilan bloklaydi.
 */
export function WorkdayOffGate({ children }: { children: ReactNode }) {
  const { data } = useWorkdayStatus();
  const blocked = data?.allowed === false;

  useEffect(() => {
    if (!blocked || typeof window === "undefined") return;
    if (window.location.pathname.startsWith(DAY_OFF_PATH)) return;
    window.location.assign(DAY_OFF_PATH);
  }, [blocked]);

  if (blocked) {
    return <p className="p-6 text-sm text-muted-foreground">Сегодня нерабочий день — перенаправление…</p>;
  }
  return <>{children}</>;
}
