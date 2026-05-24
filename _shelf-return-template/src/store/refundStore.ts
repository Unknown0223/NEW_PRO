import { create } from "zustand";
import type { CategoryKey, PriceType, RefundDraft, CartItem } from "../types/refund";
import { PRODUCTS } from "../data/mock";

interface RefundState extends RefundDraft {
  setCustomer: (id: number | null) => void;
  setOrderDate: (d: string) => void;
  setAgent: (id: number | null) => void;
  setWarehouse: (id: number | null) => void;
  setDirection: (id: number | null) => void;
  setDiscount: (id: number | null) => void;
  setPriceType: (t: PriceType) => void;
  toggleCategory: (c: CategoryKey) => void;
  selectAllCategories: (checked: boolean) => void;
  toggleComposition: (c: string) => void;
  setSearch: (q: string) => void;
  setQuantity: (productId: number, qty: number) => void;
  removeItem: (productId: number) => void;
  setComment: (s: string) => void;
  reset: () => void;
  getFilteredProducts: () => typeof PRODUCTS;
  getTotals: () => { quantity: number; volume: number; amount: number };
}

const ALL_CATEGORIES: CategoryKey[] = ["Monno", "Lalaku", "Yoyoki", "Sof", "Sahara"];

const initial: RefundDraft = {
  customerId: null,
  orderDate: new Date().toISOString().slice(0, 16),
  agentId: null,
  warehouseId: null,
  directionId: null,
  discountId: null,
  priceType: "NAQD",
  selectedCategories: [...ALL_CATEGORIES],
  compositions: [],
  search: "",
  items: [],
  comment: "",
};

export const useRefundStore = create<RefundState>((set, get) => ({
  ...initial,

  setCustomer: (id) => set({ customerId: id }),
  setOrderDate: (d) => set({ orderDate: d }),
  setAgent: (id) => set({ agentId: id }),
  setWarehouse: (id) => set({ warehouseId: id }),
  setDirection: (id) => set({ directionId: id }),
  setDiscount: (id) => set({ discountId: id }),
  setPriceType: (t) => set({ priceType: t }),

  toggleCategory: (c) =>
    set((s) => ({
      selectedCategories: s.selectedCategories.includes(c)
        ? s.selectedCategories.filter((x) => x !== c)
        : [...s.selectedCategories, c],
    })),

  selectAllCategories: (checked) =>
    set({ selectedCategories: checked ? [...ALL_CATEGORIES] : [] }),

  toggleComposition: (c) =>
    set((s) => ({
      compositions: s.compositions.includes(c)
        ? s.compositions.filter((x) => x !== c)
        : [...s.compositions, c],
    })),

  setSearch: (q) => set({ search: q }),

  setQuantity: (productId, qty) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === productId);
      let items: CartItem[];
      if (qty <= 0) {
        items = s.items.filter((i) => i.productId !== productId);
      } else if (existing) {
        items = s.items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i));
      } else {
        items = [...s.items, { productId, quantity: qty }];
      }
      return { items };
    }),

  removeItem: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

  setComment: (c) => set({ comment: c }),

  reset: () => set({ ...initial, orderDate: new Date().toISOString().slice(0, 16) }),

  getFilteredProducts: () => {
    const { selectedCategories, compositions, search } = get();
    const q = search.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (!selectedCategories.includes(p.category)) return false;
      if (compositions.length > 0 && !compositions.includes(p.composition)) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.barcode.includes(q)
      )
        return false;
      return true;
    });
  },

  getTotals: () => {
    const { items, priceType } = get();
    let quantity = 0;
    let volume = 0;
    let amount = 0;
    for (const it of items) {
      const prod = PRODUCTS.find((p) => p.id === it.productId);
      if (!prod) continue;
      const price = prod.prices[priceType] ?? 0;
      quantity += it.quantity;
      volume += it.quantity * prod.unitVolume;
      amount += it.quantity * price;
    }
    return { quantity, volume, amount };
  },
}));
