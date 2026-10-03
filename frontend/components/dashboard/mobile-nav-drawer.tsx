"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Tor ekran (md dan kichik, shu jumladan brauzer masshtabi kattalashtirilganda) uchun
 * chapdan suriladigan yon menyu. Havola bosilganda, fonga bosilganda yoki Esc da yopiladi.
 */
export function MobileNavDrawer({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", !open && "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-black/45 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-2xl transition-[transform,visibility] duration-200 ease-out",
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        )}
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("a[href]")) onClose();
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Закрыть меню"
        >
          <X className="size-5" />
        </button>
        {children}
      </aside>
    </div>
  );
}
