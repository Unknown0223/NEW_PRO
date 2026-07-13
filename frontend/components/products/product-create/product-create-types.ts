import { PRODUCT_UNIT_CUSTOM, resolveUnitFromForm } from "@/lib/product-units";

export type RefOption = { id: number; name: string; code?: string | null };

export type ProductCreateMasterData = {
  categories: RefOption[];
  groups: RefOption[];
  brands: RefOption[];
  tradeDirections: RefOption[];
  segments: RefOption[];
};

export type ProductCreateForm = {
  name: string;
  productTitle: string;
  blockQuantity: number;
  code: string;
  categoryId: number | null;
  unit: string;
  unitCustom: string;
  groupId: number | null;
  brandId: number | null;
  tradeDirectionIds: number[];
  segmentIds: number[];
  barcode: string;
  tnVed: string;
  status: boolean;
  width: number;
  height: number;
  length: number;
  volumeUnit: "m3" | "cm3";
};

export type PackageCreateForm = {
  id: string;
  name: string;
  template: string;
  blockQuantity: number;
  code: string;
  groupId: number | null;
  brandId: number | null;
  tradeDirectionIds: number[];
  segmentIds: number[];
  barcode: string;
  tnVed: string;
  default: boolean;
  status: boolean;
  width: number;
  height: number;
  length: number;
};

export type ProductCreateErrors = Partial<
  Record<"name" | "categoryId" | "unit" | "tradeDirectionIds" | "packages", string>
>;

export const emptyMasterData: ProductCreateMasterData = {
  categories: [],
  groups: [],
  brands: [],
  tradeDirections: [],
  segments: []
};

export const initialProductCreateForm: ProductCreateForm = {
  name: "",
  productTitle: "",
  blockQuantity: 0,
  code: "",
  categoryId: null,
  unit: "dona",
  unitCustom: "",
  groupId: null,
  brandId: null,
  tradeDirectionIds: [],
  segmentIds: [],
  barcode: "",
  tnVed: "",
  status: true,
  width: 0,
  height: 0,
  length: 0,
  volumeUnit: "m3"
};

export function createPackage(index: number, isDefault = false): PackageCreateForm {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    name: "",
    template: "",
    blockQuantity: 0,
    code: "",
    groupId: null,
    brandId: null,
    tradeDirectionIds: [],
    segmentIds: [],
    barcode: "",
    tnVed: "",
    default: isDefault,
    status: true,
    width: 0,
    height: 0,
    length: 0
  };
}

export function calculateVolumeM3(width: number, height: number, length: number): number {
  const volume = (Number(width || 0) * Number(height || 0) * Number(length || 0)) / 1_000_000;
  return Number.isFinite(volume) ? volume : 0;
}

export function formatVolumeLabel(
  width: number,
  height: number,
  length: number,
  unit: "m3" | "cm3" = "m3"
): string {
  const cm3 = Number(width || 0) * Number(height || 0) * Number(length || 0);
  if (unit === "cm3") {
    return `${Number.isFinite(cm3) ? cm3.toLocaleString("ru-RU") : 0} cm3`;
  }
  const value = calculateVolumeM3(width, height, length);
  return `${Number.isInteger(value) ? value : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} m3`;
}

export function validateProductCreate(
  form: ProductCreateForm,
  packages: PackageCreateForm[]
): ProductCreateErrors {
  const errors: ProductCreateErrors = {};
  if (!form.name.trim()) errors.name = "Название обязательно";
  if (!form.categoryId) errors.categoryId = "Категория обязательна";
  const unitOk =
    form.unit !== PRODUCT_UNIT_CUSTOM ? Boolean(form.unit) : Boolean(form.unitCustom.trim());
  if (!unitOk) errors.unit = "Единица измерения обязательна";
  if (form.tradeDirectionIds.length === 0) {
    errors.tradeDirectionIds = "Выберите направление торговли";
  }
  if (packages.some((item) => !item.name.trim())) {
    errors.packages = "Название каждого объекта упаковки обязательно";
  }
  return errors;
}

export function buildProductCreatePayload(
  form: ProductCreateForm,
  packages: PackageCreateForm[]
): Record<string, unknown> {
  const sku = form.code.trim() || `PRD-${Date.now().toString().slice(-8)}`;
  const unit = resolveUnitFromForm(form.unit, form.unitCustom);
  const packagings = packages
    .filter((p) => p.name.trim())
    .map((p, index) => ({
      name: p.name.trim(),
      quantity: p.blockQuantity > 0 ? p.blockQuantity : null,
      width_cm: p.width > 0 ? p.width : null,
      height_cm: p.height > 0 ? p.height : null,
      length_cm: p.length > 0 ? p.length : null,
      is_main: p.default,
      sort_order: index
    }));

  const hasDims = form.width > 0 && form.height > 0 && form.length > 0;

  return {
    sku,
    name: form.name.trim(),
    unit,
    category_id: form.categoryId,
    is_active: form.status,
    barcode: form.barcode.trim() || null,
    hs_code: form.tnVed.trim().slice(0, 32) || null,
    sell_code: form.productTitle.trim().slice(0, 64) || null,
    product_group_id: form.groupId,
    brand_id: form.brandId,
    segment_ids: form.segmentIds.length ? form.segmentIds : undefined,
    trade_direction_ids: form.tradeDirectionIds.length ? form.tradeDirectionIds : undefined,
    qty_per_block: form.blockQuantity > 0 ? form.blockQuantity : null,
    dimension_unit: "cm",
    width_cm: hasDims ? String(form.width) : null,
    height_cm: hasDims ? String(form.height) : null,
    length_cm: hasDims ? String(form.length) : null,
    volume_m3: hasDims ? String(calculateVolumeM3(form.width, form.height, form.length)) : null,
    packagings: packagings.length ? packagings : undefined
  };
}
