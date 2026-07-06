export interface Packaging {
  id: string;
  name: string;
  isMain: boolean;
  quantity: string;
  width: string;
  height: string;
  length: string;
}

export interface ProductAddForm {
  name: string;
  categoryId: string;
  code: string;
  barcode: string;
  unit: string;
  unitCustom: string;
  blockCount: string;
  brandId: string;
  segmentIds: string[];
  tradeDirectionIds: string[];
  weight: string;
  width: string;
  height: string;
  length: string;
  dimensionUnit: "m" | "cm";
  tnved: string;
  ikpu: string;
  active: boolean;
  image: string | null;
  packagings: Packaging[];
}

export const emptyProductAddForm: ProductAddForm = {
  name: "",
  categoryId: "",
  code: "",
  barcode: "",
  unit: "dona",
  unitCustom: "",
  blockCount: "",
  brandId: "",
  segmentIds: [],
  tradeDirectionIds: [],
  weight: "",
  width: "",
  height: "",
  length: "",
  dimensionUnit: "m",
  tnved: "",
  ikpu: "",
  active: true,
  image: null,
  packagings: []
};

export const PACKAGING_TEMPLATES: Array<
  Omit<Packaging, "id" | "isMain"> & { label: string }
> = [
  { label: "Korobka (standart)", name: "Korobka", quantity: "12", width: "20", height: "30", length: "40" },
  { label: "Blok (kichik)", name: "Blok", quantity: "6", width: "15", height: "20", length: "25" },
  { label: "Pallet", name: "Pallet", quantity: "480", width: "80", height: "180", length: "120" },
  { label: "Termoplyonka", name: "Termoplyonka", quantity: "24", width: "30", height: "25", length: "45" }
];

export function calcVolume(w: string, h: string, l: string, unit: "m" | "cm"): number {
  const width = Number.parseFloat(w) || 0;
  const height = Number.parseFloat(h) || 0;
  const length = Number.parseFloat(l) || 0;
  const k = unit === "cm" ? 0.01 : 1;
  return width * k * height * k * length * k;
}

export function productAddDraftKey(tenantSlug: string | null): string {
  return `salec-add-product-draft:${tenantSlug ?? "default"}`;
}
