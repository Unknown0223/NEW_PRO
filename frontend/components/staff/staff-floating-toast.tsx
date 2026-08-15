"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_AUTO_DISMISS_MS = 2000;

export type StaffFloatingToastTone = "success" | "error";

export function StaffFloatingToast({
  message,
  tone = "success"
}: {
  message: string | null;
  tone?: StaffFloatingToastTone;
}) {
  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg",
          tone === "success"
            ? "bg-emerald-600 ring-1 ring-emerald-700/20"
            : "bg-rose-600 ring-1 ring-rose-700/20"
        )}
      >
        {tone === "success" ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
        {message}
      </div>
    </div>
  );
}

export function useStaffFloatingToast(autoDismissMs = DEFAULT_AUTO_DISMISS_MS) {
  const [toast, setToastState] = useState<{ message: string; tone: StaffFloatingToastTone } | null>(
    null
  );

  const setToast = useCallback(
    (message: string | null, tone: StaffFloatingToastTone = "success") => {
      if (!message) {
        setToastState(null);
        return;
      }
      setToastState({ message, tone });
    },
    []
  );

  const clearToast = useCallback(() => setToastState(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToastState(null), autoDismissMs);
    return () => clearTimeout(t);
  }, [toast, autoDismissMs]);

  return {
    toast: toast?.message ?? null,
    toastTone: toast?.tone ?? "success",
    setToast,
    clearToast
  };
}
