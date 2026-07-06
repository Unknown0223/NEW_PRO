/** Xaritada har bir chegara uchun alohida rang (turi + tartib bo‘yicha). */
export const GEO_BOUNDARY_PALETTE = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#db2777",
  "#ea580c",
  "#0f766e",
  "#ca8a04",
  "#4f46e5",
  "#be123c"
] as const;

export function geoBoundaryColor(index: number, fallback = "#7c3aed"): string {
  if (index < 0) return fallback;
  return GEO_BOUNDARY_PALETTE[index % GEO_BOUNDARY_PALETTE.length] ?? fallback;
}

/** Saqlangan rang yoki palette bo‘yicha avtomatik (takrorlanmaydi). */
export function resolveBoundaryColor(
  boundary: { color?: string } | null | undefined,
  index: number,
  allBoundaries: { color?: string }[]
): string {
  const stored = boundary?.color?.trim();
  if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) return stored.toLowerCase();
  const used = new Set(
    allBoundaries
      .map((b, i) => (i === index ? null : b.color?.toLowerCase()))
      .filter((c): c is string => Boolean(c))
  );
  for (const c of GEO_BOUNDARY_PALETTE) {
    if (!used.has(c)) return c;
  }
  return geoBoundaryColor(index);
}

/** Barcha mavjud chegaralardan farqli yangi rang tanlaydi. */
export function pickUnusedBoundaryColor(allBoundaries: { color?: string }[]): string {
  const used = new Set<string>();
  allBoundaries.forEach((b, i) => {
    used.add(resolveBoundaryColor(b, i, allBoundaries).toLowerCase());
  });
  for (const c of GEO_BOUNDARY_PALETTE) {
    if (!used.has(c)) return c;
  }
  return GEO_BOUNDARY_PALETTE[allBoundaries.length % GEO_BOUNDARY_PALETTE.length] ?? "#7c3aed";
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
