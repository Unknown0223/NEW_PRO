export type PriceMatrixCategory = { id: number; name: string; parent_id: number | null };

export type PriceMatrixRow = {
  product_id: number;
  name: string;
  sku: string;
  price: string | null;
  currency: string;
  category_id?: number | null;
  category_name?: string | null;
};

export function flattenCategories(rows: PriceMatrixCategory[]): { id: number; label: string }[] {
  const byParent = new Map<number | null, PriceMatrixCategory[]>();
  for (const r of rows) {
    const k = r.parent_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  Array.from(byParent.values()).forEach((list) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "uz"));
  });
  const out: { id: number; label: string }[] = [];
  const walk = (parentId: number | null, prefix: string) => {
    const kids = byParent.get(parentId) ?? [];
    for (const c of kids) {
      const label = prefix ? `${prefix} / ${c.name}` : c.name;
      out.push({ id: c.id, label });
      walk(c.id, label);
    }
  };
  walk(null, "");
  return out;
}

export function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}
