export type PriceType = "OLD" | "BONUS" | "NAQD" | "TERMINAL" | "PERECHISLENIYE";

export type CategoryKey = "Monno" | "Lalaku" | "Yoyoki" | "Sof" | "Sahara";

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  region: string;
}

export interface Agent {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
}

export interface TradeDirection {
  id: number;
  name: string;
}

export interface DiscountType {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  barcode: string;
  category: CategoryKey;
  composition: string;
  unitVolume: number; // L
  unit: string; // sht / quti
  prices: Record<PriceType, number>;
}

export interface CartItem {
  productId: number;
  quantity: number;
}

export interface RefundDraft {
  customerId: number | null;
  orderDate: string;
  agentId: number | null;
  warehouseId: number | null;
  directionId: number | null;
  discountId: number | null;
  priceType: PriceType;
  selectedCategories: CategoryKey[];
  compositions: string[];
  search: string;
  items: CartItem[];
  comment: string;
}
