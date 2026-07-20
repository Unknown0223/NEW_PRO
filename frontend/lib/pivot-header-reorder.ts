/** Ustun/maydon tartibini sudrab almashtirish. */
export function moveFieldId(ids: string[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return null;
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0) return null;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (item == null) return null;
  next.splice(to, 0, item);
  return next;
}

export type HeaderDragZone = "rows" | "flat" | "values" | "columns";

export type HeaderDragPayload = {
  zone: HeaderDragZone;
  fieldId: string;
};

/** Flat jadval ustunlari: rows → columns → values (takrorlarsiz). */
export function flatColumnIdsFromConfig(config: {
  rows: string[];
  columns: string[];
  values: { fieldId: string }[];
}): string[] {
  const ordered = [...config.rows, ...config.columns, ...config.values.map((v) => v.fieldId)];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Pointer DnD: shu masofadan keyin sudrash boshlangan hisoblanadi. */
export const HEADER_DRAG_ACTIVATION_PX = 6;

export function headerDragActivated(dx: number, dy: number, threshold = HEADER_DRAG_ACTIVATION_PX): boolean {
  return dx * dx + dy * dy >= threshold * threshold;
}

export function parseHeaderDragTarget(
  el: Element | null
): HeaderDragPayload | null {
  const th = el?.closest?.("[data-pg-header-drag-zone][data-pg-header-drag-field]") as HTMLElement | null;
  if (!th) return null;
  const zone = th.getAttribute("data-pg-header-drag-zone") as HeaderDragZone | null;
  const fieldId = th.getAttribute("data-pg-header-drag-field");
  if (!zone || !fieldId) return null;
  return { zone, fieldId };
}
