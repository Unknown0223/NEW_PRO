export function effectiveReturnPriceType(raw: string | null | undefined): string {
  return (raw ?? "").trim() || "retail";
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderItemSummary = {
  product_id: number;
  sku: string;
  name: string;
  unit: string;
  qty: string;
  price: string;
  total: string;
  is_bonus: boolean;
  order_id: number;
  order_number: string;
  /** Kategoriya filtri (frontend) — mahsulot jadvalidan. */
  category_id: number | null;
};

export type OrderReturnBalance = {
  order_id: number;
  initial_paid_qty: number;
  initial_bonus_qty: number;
  returned_paid_qty: number;
  returned_bonus_qty: number;
  remaining_paid_qty: number;
  remaining_bonus_qty: number;
  fully_returned: boolean;
};

import type { ReturnFilterMeta } from "./returns-filter.types";

export type { ReturnFilterMeta };

export type ClientReturnsData = {
  /** `period` — mijoz+davr (zakazsiz yig‘indi); `order` — bitta zakaz doirasi */
  polki_scope: "period" | "order";
  orders: {
    id: number;
    number: string;
    status: string;
    total_sum: string;
    bonus_sum: string;
    created_at: string;
  }[];
  items: OrderItemSummary[];
  /** Po zakaz: boshlang‘ich / qaytarilgan / qoldiq (pullik + bonus). */
  order_balance?: OrderReturnBalance | null;
  /** Mijozning barcha yetkazilgan zakazlari uchun qoldiq (tanlash ro‘yxati). */
  order_balances?: OrderReturnBalance[];
  total_orders: number;
  total_returned_qty: string;
  total_paid_value: string;
  already_returned_value: string;
  max_returnable_value: string;
  client_balance: string;
  client_debt: string;
  filter_meta?: ReturnFilterMeta;
};

export type CreatePeriodReturnLine = {
  product_id: number;
  /** Legacy: bitta miqdor, server bonus/paid bo‘lishini hisoblaydi */
  qty?: number;
  /** Aniq: pullik qaytarish dona (ombor) */
  paid_qty?: number;
  /** Aniq: bonus mahsulot dona (ombor) */
  bonus_qty?: number;
  /** Bonus o‘rniga naqd kompensatsiya (balans/kassa, omborga bonus dona qo‘shilmaydi) */
  bonus_cash?: number;
  /** Erkin polki: foydalanuvchi «всего к возврату» — server bonus-debt hisobi uchun */
  return_qty?: number;
};

export type CreatePeriodReturnInput = {
  warehouse_id?: number;
  client_id: number;
  order_id?: number;
  date_from?: string;
  date_to?: string;
  /** Zakaz yaratishdagi narx turi; bo‘lmasa `retail` (interchangeable tekshiruvi). */
  price_type?: string | null;
  lines: CreatePeriodReturnLine[];
  note?: string | null;
  refusal_reason_ref?: string | null;
  /** Kamchilik bo‘yicha «Долг бонус» — mijoz balansiga manfiy delta (ixtiyoriy). */
  bonus_debt_amount?: number;
};

/** Bir nechta zakazdan bir vaqtda polki qaytarish (har zakaz uchun alohida sales_return). */
export type CreatePeriodReturnBatchLine = {
  order_id: number;
  product_id: number;
  qty?: number;
  paid_qty?: number;
  bonus_qty?: number;
  bonus_cash?: number;
  return_qty?: number;
};

export type CreatePeriodReturnBatchInput = {
  warehouse_id?: number;
  client_id: number;
  price_type?: string | null;
  bonus_debt_amount?: number;
  lines: CreatePeriodReturnBatchLine[];
  note?: string | null;
  refusal_reason_ref?: string | null;
};

export type PeriodReturnBatchResult = {
  returns: PeriodReturnResult[];
};

export type PeriodReturnResult = {
  id: number;
  number: string;
  refund_amount: string | null;
  lines: {
    product_id: number;
    sku: string;
    name: string;
    qty: string;
    paid_qty: string;
    bonus_qty: string;
    paid_amount: string;
  }[];
  bonus_recalc: {
    original_bonus_qty: number;
    remaining_bonus_qty: number;
    excess_bonus: number;
    total_return_qty: number;
    paid_return_qty: number;
    bonus_return_qty: number;
    refund_amount: string;
  };
};
export type FullReturnInput = {
  order_id: number;
  warehouse_id?: number;
  price_type?: string | null;
  note?: string | null;
  refund_amount?: number;
  refusal_reason_ref?: string | null;
};
