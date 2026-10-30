"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** «Есть несохраненные изменения» — pastki yopishqoq panel. */
export function AccessUnsavedBar({
  added,
  removed,
  pending,
  onCancel,
  onSave
}: {
  added: number;
  removed: number;
  pending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Несохраненные изменения"
      className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-md dark:border-amber-800 dark:bg-amber-950/60"
    >
      <div className="text-sm">
        <span className="font-semibold text-amber-900 dark:text-amber-100">Есть несохраненные изменения</span>
        <span className="ml-2 text-xs text-amber-800/90 dark:text-amber-200/90">
          {added > 0 ? `+${added} добавить` : null}
          {added > 0 && removed > 0 ? " · " : null}
          {removed > 0 ? `−${removed} открепить` : null}
        </span>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Отменить изменения
        </Button>
        <Button type="button" size="sm" className="bg-teal-700 text-white hover:bg-teal-800" disabled={pending} onClick={onSave}>
          {pending ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>
    </div>
  );
}

export type AccessToast = { tone: "ok" | "err"; text: string; detail?: string };

/** Kichik bildirishnoma (ilovada umumiy toast yo'q). */
export function useAccessToast() {
  const [toast, setToast] = useState<AccessToast | null>(null);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (t: AccessToast) => {
    setToast(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), t.tone === "ok" ? 2600 : 6000);
  };
  const node = toast ? (
    <div
      role={toast.tone === "err" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
        toast.tone === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      )}
    >
      <p className="font-medium">{toast.text}</p>
      {toast.detail ? <p className="mt-1 text-xs opacity-90">{toast.detail}</p> : null}
    </div>
  ) : null;
  return { show, node };
}

/** Brauzerni yopish / yangilashda ogohlantirish. */
export function useBeforeUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

export const LEAVE_UNSAVED_MESSAGE = "У вас есть несохраненные изменения. Вы действительно хотите покинуть страницу?";
