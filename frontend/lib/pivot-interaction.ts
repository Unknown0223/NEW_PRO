/**
 * Pivot UI interaction helpers — unit-tested contracts for Fields modal + row expand.
 */

import { classicPathPrefixKey } from "@/lib/pivot-flatten";

/** Single click on palette label: add if not in layout. */
export function paletteLabelClickAction(checked: boolean): "add" | "none" {
  return checked ? "none" : "add";
}

/**
 * Double-click on palette label: remove only if it was already in layout
 * at pointer-down (avoids add-then-remove on dblclick of unchecked).
 */
export function paletteLabelDoubleClickAction(checkedAtPointerDown: boolean): "remove" | "none" {
  return checkedAtPointerDown ? "remove" : "none";
}

/** Compact/tree label click: expand when group has children; never sort. */
export function rowLabelClickAction(hasChildren: boolean): "toggle-expand" | "none" {
  return hasChildren ? "toggle-expand" : "none";
}

/**
 * Classic multi-column: cell click must toggle the path PREFIX (Клиент / Область),
 * NOT the leaf rowKey. Otherwise [-] looks expanded but flatten never collapses.
 */
export function classicDimClickToggleKey(
  fullLabels: string[],
  colIdx: number,
  rowFieldCount: number,
  visibleText: string
): string | null {
  if (rowFieldCount <= 1) return null;
  if (colIdx < 0 || colIdx >= rowFieldCount - 1) return null;
  if (!visibleText.trim()) return null;
  return classicPathPrefixKey(fullLabels, colIdx);
}

/** Header (thead) click may sort; body must not. */
export function isSortAllowedFromTarget(target: "header" | "body"): boolean {
  return target === "header";
}
