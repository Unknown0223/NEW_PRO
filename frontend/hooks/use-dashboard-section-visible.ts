"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
  /** Trigger visibility once and keep true (default true). */
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
  /** When false, observer is not attached. */
  enabled?: boolean;
};

/**
 * Returns true when the ref element enters (or has entered) the viewport.
 * Used to defer heavy dashboard API calls until the user scrolls to a section.
 */
export function useDashboardSectionVisible(options: Options = {}) {
  const { once = true, rootMargin = "120px", threshold = 0.05, enabled = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, once, rootMargin, threshold]);

  return { ref, visible };
}
