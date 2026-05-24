/** Order create workspace — local types. */

import type { Dispatch, SetStateAction } from "react";
import type { ProductRow } from "@/lib/product-types";

export type OrderCreateProps = {
  tenantSlug: string | null;
  onCreated: () => void;
  onCancel: () => void;
  /** Hujjat tipi: order | return | exchange | partial_return | return_by_order */
  orderType?: string;
};

export type PolkiPairRowModel = {
  pair_key: string;
  order_id: number;
  order_number: string;
  product_id: number;
  name: string;
  sku: string;
  unit: string;
  max_paid: number;
  max_bonus: number;
  unit_price_paid: number;
  unit_price_bonus: number;
  category_id: number | null;
  volume_m3: string | null | undefined;
};

export type PolkiClientItem = {
  product_id: number;
  sku: string;
  name: string;
  unit: string;
  qty: string;
  price: string;
  is_bonus: boolean;
  order_id?: number;
  order_number?: string;
  category_id?: number | null;
};

export type PolkiOrderGroup = {
  orderId: number;
  orderNumber: string;
  orderDate: string;
  rows: PolkiPairRowModel[];
};

export type PolkiOrderPickRow = {
  id: number;
  number: string;
  status: string;
  created_at: string;
  order_type?: string | null;
  qty?: string;
  total_sum?: string;
  bonus_qty?: string;
  bonus_sum?: string;
  discount_sum?: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  agent_id?: number | null;
  agent_trade_direction?: string | null;
  /** Zakaz `payment_method_ref` — odatda narx turi kaliti bilan mos */
  price_type?: string | null;
  payment_method_ref?: string | null;
};

export type PolkiLinesTableProps = {
  canShowPolkiGrid: boolean;
  isPolkiByOrder: boolean;
  isPolkiFree: boolean;
  groupLinesByOrder?: boolean;
  polkiLoading: boolean;
  polkiError: boolean;
  polkiSuccess: boolean;
  polkiRowsAllLength: number;
  polkiOrderGroups: PolkiOrderGroup[];
  polkiTotalQty: Record<string, string>;
  setPolkiTotalQty: Dispatch<SetStateAction<Record<string, string>>>;
  polkiBonusToBalance: Record<string, boolean>;
  setPolkiBonusToBalance: Dispatch<SetStateAction<Record<string, boolean>>>;
  polkiBonusCash: Record<string, string>;
  setPolkiBonusCash: Dispatch<SetStateAction<Record<string, string>>>;
  mutationPending: boolean;
  polkiTotalReturnQtySum: number;
  polkiVolumeM3: number;
  polkiEstimatedSum: number;
  polkiDebtHintSum: number;
  polkiExpandedOrderId?: number | null;
  setPolkiExpandedOrderId?: Dispatch<SetStateAction<number | null>>;
  polkiPeresortByPairKey?: Record<string, number>;
  setPolkiPeresortByPairKey?: Dispatch<SetStateAction<Record<string, number>>>;
  polkiPeresortOptionsByProductId?: Map<number, Array<{ id: number; name: string }>>;
  polkiAutoBonusExplicitByPairKey?: Record<string, { paid: number; bonus: number }>;
  polkiAutoBonusDebtByPairKey?: Record<string, number>;
  polkiAutoBonusPreviewLinesByProductId?: Map<
    number,
    import("./hooks/use-polki-auto-bonus").PolkiAutoBonusPreviewLine
  >;
  polkiAutoBonusPreviewPending?: boolean;
  polkiAutoBonusPreviewError?: boolean;
  polkiBonusCalcMode?: import("./view/polki-shelf-return/polki-bonus-calc").PolkiBonusCalcMode;
};

export type OrderCreateContextResponse = {
  clients: Array<{ id: number; name: string; agent_id?: number | null }>;
  products: ProductRow[];
  warehouses: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string; role: string }>;
  categories: Array<{ id: number; name: string }>;
  payment_method_refs?: string[];
  request_type_refs?: string[];
  order_note_refs?: string[];
  refusal_reason_refs?: string[];
};

export type ClientReturnDataPolki = {
  items: PolkiClientItem[];
  orders: PolkiOrderPickRow[];
};
