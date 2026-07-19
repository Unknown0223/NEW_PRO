import type { PivotField } from "@salec/pivot-engine";

/** Preferred drill-through columns for SALEC sales lines. */
export const SALEC_DRILL_PREFERRED = [
  "client_name",
  "agent_name",
  "category_name",
  "product_name",
  "product_sku",
  "brand_name",
  "is_bonus",
  "bonus_qty",
  "amount",
  "qty",
  "volume",
  "order_number",
  "order_status"
] as const;

export const SALEC_DRILL_EXCLUDED = new Set([
  "client_category",
  "client_zone",
  "client_region",
  "client_city",
  "agent_branch",
  "agent_code",
  "work_slot_code"
]);

export const GENERIC_DRILL_PREFERRED = [
  "Country",
  "Category",
  "Product",
  "Price",
  "Discount",
  "Quantity"
] as const;

const DEFAULT_MAX = 14;

export function resolveDrillThroughColumns(
  records: Record<string, unknown>[],
  fields: PivotField[],
  opts: {
    preferred?: readonly string[];
    excluded?: Set<string>;
    valueFieldId?: string;
    maxColumns?: number;
  } = {}
): string[] {
  const preferred = opts.preferred ?? GENERIC_DRILL_PREFERRED;
  const excluded = opts.excluded ?? new Set<string>();
  const max = opts.maxColumns ?? DEFAULT_MAX;

  const present = new Set<string>();
  for (const row of records.slice(0, 80)) {
    for (const key of Object.keys(row)) {
      if (!excluded.has(key)) present.add(key);
    }
  }

  const ordered: string[] = [];
  const push = (id: string) => {
    if (!present.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };

  if (opts.valueFieldId) push(opts.valueFieldId);
  for (const id of preferred) push(id);
  for (const f of fields) {
    if (ordered.length >= max) break;
    push(f.id);
  }
  for (const id of present) {
    if (ordered.length >= max) break;
    push(id);
  }
  return ordered.slice(0, max);
}
