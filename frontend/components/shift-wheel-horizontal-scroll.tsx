"use client";

import { useEffect } from "react";

function findHorizontalScrollParent(el: Element | null): HTMLElement | null {
  let node = el instanceof HTMLElement ? el : null;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const ox = style.overflowX;
    if (ox === "auto" || ox === "scroll" || ox === "overlay") {
      if (node.scrollWidth > node.clientWidth + 1) return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Shift + vertikal g‘ildirak → eng yaqin gorizontal scroll konteynerini suradi.
 */
export function ShiftWheelHorizontalScroll() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      const target = e.target instanceof Element ? e.target : null;
      const scroller = findHorizontalScrollParent(target);
      if (!scroller) return;
      e.preventDefault();
      scroller.scrollLeft += delta;
    };
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
  return null;
}
