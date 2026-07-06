export interface Packaging {
  id: string;
  name: string;
  isMain: boolean;
  quantity: string;
  width: string;
  height: string;
  length: string;
}

export interface ProductForm {
  name: string;
  category: string;
  code: string;
  barcode: string;
  unit: string;
  blockCount: string;
  brand: string;
  segments: string[];
  tradeDirections: string[];
  weight: string;
  width: string;
  height: string;
  length: string;
  dimensionUnit: "m" | "sm";
  tnved: string;
  ikpu: string;
  active: boolean;
  image: string | null;
  packagings: Packaging[];
}

export const emptyForm: ProductForm = {
  name: "",
  category: "",
  code: "",
  barcode: "",
  unit: "",
  blockCount: "",
  brand: "",
  segments: [],
  tradeDirections: [],
  weight: "",
  width: "",
  height: "",
  length: "",
  dimensionUnit: "m",
  tnved: "",
  ikpu: "",
  active: true,
  image: null,
  packagings: [],
};

export const CATEGORIES = [
  "Ichimliklar",
  "Sut mahsulotlari",
  "Shirinliklar",
  "Un mahsulotlari",
  "Konservalar",
  "Maishiy kimyo",
  "Gigiyena vositalari",
];

export const UNITS = ["Dona", "Blok", "Kg", "Litr", "Quti", "Metr"];

export const BRANDS = [
  "Coca-Cola",
  "Nestlé",
  "Lactel",
  "Sarva",
  "Makfa",
  "Colgate",
  "P&G",
  "Unilever",
];

export const SEGMENTS = [
  "Premium",
  "O'rta segment",
  "Ekonom",
  "HoReCa",
  "B2B",
];

export const TRADE_DIRECTIONS = [
  "Chakana savdo",
  "Ulgurji savdo",
  "Distributsiya",
  "Eksport",
  "Online savdo",
];

export const PACKAGING_TEMPLATES: Array<
  Omit<Packaging, "id" | "isMain"> & { label: string }
> = [
  { label: "Korobka (standart)", name: "Korobka", quantity: "12", width: "20", height: "30", length: "40" },
  { label: "Blok (kichik)", name: "Blok", quantity: "6", width: "15", height: "20", length: "25" },
  { label: "Pallet", name: "Pallet", quantity: "480", width: "80", height: "180", length: "120" },
  { label: "Termoplyonka", name: "Termoplyonka", quantity: "24", width: "30", height: "25", length: "45" },
];

export function calcVolume(w: string, h: string, l: string, unit: "m" | "sm"): number {
  const width = parseFloat(w) || 0;
  const height = parseFloat(h) || 0;
  const length = parseFloat(l) || 0;
  const k = unit === "sm" ? 0.01 : 1;
  return width * k * height * k * length * k;
}
