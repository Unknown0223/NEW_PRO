"use client";

import { ClientLucideIcon } from "@/components/ui/client-lucide-icon";
import { scrollEdgeVisibility } from "@/lib/scroll-edge-visibility";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type ScrollEdgeHintsProps = {
  children: ReactNode;
  /** Scroll konteyner classlari */
  contentClassName?: string;
  className?: string;
  /** Ichki kontent o‘zgaganda qayta o‘lchash (masalan ochilgan menyu). */
  watch?: unknown;
};

export function ScrollEdgeHints({ children, contentClassName, className, watch }: ScrollEdgeHintsProps) {
  const ref = useRef<HTMLNavElement>(null);
  const [up, setUp] = useState(false);
  const [down, setDown] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = scrollEdgeVisibility(el.scrollTop, el.scrollHeight, el.clientHeight);
    setUp(next.up);
    setDown(next.down);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, watch]);

  const jump = (dir: -1 | 1) => {
    ref.current?.scrollBy({ top: dir * 180, behavior: "smooth" });
  };

  return (
    <div className={cn("relative min-h-0 min-w-0 flex-1", className)}>
      {up ? (
        <button
          type="button"
          className="absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-center bg-gradient-to-b from-sidebar via-sidebar/85 to-transparent text-sidebar-foreground/75 hover:text-sidebar-foreground"
          aria-label="Прокрутить вверх"
          onClick={() => jump(-1)}
        >
          <ClientLucideIcon icon={ChevronUp} className="size-4" />
        </button>
      ) : null}
      <nav
        ref={ref}
        className={cn("h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain", contentClassName)}
      >
        {children}
      </nav>
      {down ? (
        <button
          type="button"
          className="absolute inset-x-0 bottom-0 z-10 flex h-8 items-center justify-center bg-gradient-to-t from-sidebar via-sidebar/85 to-transparent text-sidebar-foreground/75 hover:text-sidebar-foreground"
          aria-label="Прокрутить вниз"
          onClick={() => jump(1)}
        >
          <ClientLucideIcon icon={ChevronDown} className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
