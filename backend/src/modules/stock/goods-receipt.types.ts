export type GoodsReceiptListRow = {
  id: number;
  number: string;
  status: string;
  created_at: string;
  receipt_at: string | null;
  total_qty: string;
  total_sum: string;
  total_volume_m3: string;
  total_weight_kg: string;
  comment: string | null;
  price_type: string;
  external_ref: string | null;
  warehouse_id: number;
  warehouse_name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_name: string | null;
  delete_reason_ref: string | null;
};

export type CreateGoodsReceiptLineInput = {
  product_id: number;
  qty: number;
  unit_price?: number | null;
  defect_qty?: number | null;
};

export type UpsertGoodsReceiptInput = {
  warehouse_id: number;
  supplier_id?: number | null;
  receipt_at?: string | null;
  comment?: string | null;
  price_type: string;
  external_ref?: string | null;
  status: "draft" | "posted";
  lines: CreateGoodsReceiptLineInput[];
};
