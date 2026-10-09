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
 * Bloklovchi (passive: false) wheel listener faqat Shift bosilgan paytda ulanadi —
 * aks holda brauzer har bir scroll/touchpad jestida JS ni kutadi (scroll qotadi, swipe-back ishlamaydi).
 */
export function ShiftWheelHorizontalScroll() {
  useEffect(() => {
    let attached = false;

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

    const attach = () => {
      if (attached) return;
      attached = true;
      document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    };
    const detach = () => {
      if (!attached) return;
      attached = false;
      document.removeEventListener("wheel", onWheel, { capture: true });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") attach();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") detach();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", detach);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", detach);
      detach();
    };
  }, []);
  return null;
}
