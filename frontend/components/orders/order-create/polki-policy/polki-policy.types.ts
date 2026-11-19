import type { ReturnFilterMetaView } from "@/lib/return-filter-messages";

export type OrderReturnBalanceView = {
  order_id: number;
  initial_paid_qty: number;
  initial_bonus_qty: number;
  returned_paid_qty: number;
  returned_bonus_qty: number;
  remaining_paid_qty: number;
  remaining_bonus_qty: number;
  fully_returned: boolean;
};

export type ClientReturnDataPolki = {
  polki_scope?: "period" | "order";
  filter_meta?: ReturnFilterMetaView;
  orders?: Array<{
    id: number;
    number: string;
    status: string;
    created_at: string;
    total_sum?: string;
    bonus_sum?: string;
  }>;
  order_balance?: OrderReturnBalanceView | null;
  order_balances?: OrderReturnBalanceView[];
  items: Array<{
    product_id: number;
    sku: string;
    name: string;
    unit: string;
    qty: string;
    price: string;
    is_bonus: boolean;
    order_id?: number;
    order_number?: string;
  }>;
  max_returnable_value: string;
};
