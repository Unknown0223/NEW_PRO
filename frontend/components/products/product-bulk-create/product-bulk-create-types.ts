import { PRODUCT_UNIT_CUSTOM, resolveUnitFromForm } from "@/lib/product-units";
import { calculateVolumeM3 } from "../product-create/product-create-types";

export type RefOption = { id: number; name: string; code?: string | null };

export type BulkProductMasterData = {
  categories: RefOption[];
  groups: RefOption[];
  brands: RefOption[];
  tradeDirections: RefOption[];
};

export type BulkProductRow = {
  id: string;
  categoryId: number | null;
  name: string;
  productTitle: string;
  unit: string;
  unitCustom: string;
  groupId: number | null;
  brandId: number | null;
  tradeDirectionIds: number[];
  blockQuantity: number;
  code: string;
  barcode: string;
  tnVed: string;
  width: number;
  height: number;
  length: number;
  status: boolean;
};

export type BulkApplyState = {
  categoryId: number | null;
  unit: string;
  unitCustom: string;
  groupId: number | null;
  brandId: number | null;
  tradeDirectionIds: number[];
};

export const emptyBulkMasterData: BulkProductMasterData = {
  categories: [],
  groups: [],
  brands: [],
  tradeDirections: []
};

export const initialBulkApply: BulkApplyState = {
  categoryId: null,
  unit: "dona",
  unitCustom: "",
  groupId: null,
  brandId: null,
  tradeDirectionIds: []
};

export function createBulkRow(index = 0): BulkProductRow {
  return {
    id: `bulk-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    categoryId: null,
    name: "",
    productTitle: "",
    unit: "dona",
    unitCustom: "",
    groupId: null,
    brandId: null,
    tradeDirectionIds: [],
    blockQuantity: 0,
    code: "",
    barcode: "",
    tnVed: "",
    width: 0,
    height: 0,
    length: 0,
    status: true
  };
}

export function createInitialBulkRows(count = 3): BulkProductRow[] {
  return Array.from({ length: count }, (_, index) => createBulkRow(index));
}

export function isBulkRowFilled(row: BulkProductRow): boolean {
  return Boolean(row.name.trim());
}

export function validateBulkRows(rows: BulkProductRow[]): Record<number, string> {
  const errors: Record<number, string> = {};
  rows.forEach((row, index) => {
    if (!isBulkRowFilled(row)) return;
    const parts: string[] = [];
    if (!row.categoryId) parts.push("категория");
    if (!row.name.trim()) parts.push("название");
    const unitOk =
      row.unit !== PRODUCT_UNIT_CUSTOM ? Boolean(row.unit) : Boolean(row.unitCustom.trim());
    if (!unitOk) parts.push("единица измерения");
    if (parts.length) errors[index] = `Заполните: ${parts.join(", ")}`;
  });
  return errors;
}

export function buildBulkItems(rows: BulkProductRow[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  rows.forEach((row, index) => {
    if (!isBulkRowFilled(row)) return;
    const unit = resolveUnitFromForm(row.unit, row.unitCustom);
    const sku = row.code.trim() || `BULK-${Date.now()}-${index + 1}`;
    const hasDims = row.width > 0 && row.height > 0 && row.length > 0;
    items.push({
      sku,
      name: row.name.trim(),
      unit: unit || "dona",
      category_id: row.categoryId,
      is_active: row.status,
      sell_code: row.productTitle.trim().slice(0, 64) || null,
      barcode: row.barcode.trim() || null,
      hs_code: row.tnVed.trim().slice(0, 32) || null,
      product_group_id: row.groupId,
      brand_id: row.brandId,
      trade_direction_ids: row.tradeDirectionIds.length ? row.tradeDirectionIds : undefined,
      qty_per_block: row.blockQuantity > 0 ? row.blockQuantity : null,
      dimension_unit: "cm",
      width_cm: hasDims ? String(row.width) : null,
      height_cm: hasDims ? String(row.height) : null,
      length_cm: hasDims ? String(row.length) : null,
      volume_m3: hasDims ? String(calculateVolumeM3(row.width, row.height, row.length)) : null
    });
  });
  return items;
}

export function itemsZodRowMessages(per: Record<string, string>): Record<number, string> {
  const acc: Record<number, string[]> = {};
  for (const [k, msg] of Object.entries(per)) {
    const m = /^items\.(\d+)\./.exec(k);
    if (!m) continue;
    const idx = Number.parseInt(m[1], 10);
    if (!Number.isFinite(idx)) continue;
    if (!acc[idx]) acc[idx] = [];
    acc[idx].push(msg);
  }
  const out: Record<number, string> = {};
  for (const [ks, msgs] of Object.entries(acc)) {
    out[Number.parseInt(ks, 10)] = msgs.join(" · ");
  }
  return out;
}

export function applyBulkPatch(
  rows: BulkProductRow[],
  selected: boolean[],
  patch: Partial<BulkProductRow>
): BulkProductRow[] {
  const hasSelection = selected.some(Boolean);
  return rows.map((row, index) => {
    if (hasSelection && !selected[index]) return row;
    return { ...row, ...patch };
  });
}
