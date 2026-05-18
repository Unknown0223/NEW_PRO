export type CreateTransferLineInput = {
  product_id: number;
  qty: number;
  batch_no?: string | null;
  comment?: string | null;
};

export type CreateTransferInput = {
  source_warehouse_id: number;
  destination_warehouse_id: number;
  comment?: string | null;
  planned_date?: string | null;
  lines: CreateTransferLineInput[];
};

export type UpdateTransferInput = {
  source_warehouse_id?: number;
  destination_warehouse_id?: number;
  comment?: string | null;
  planned_date?: string | null;
  lines?: CreateTransferLineInput[];
};

export type GetTransfersOptions = {
  status?: string;
  source_warehouse_id?: number;
  destination_warehouse_id?: number;
  page?: number;
  limit?: number;
};

export type TransferListRow = {
  id: number;
  number: string;
  status: string;
  source_warehouse_id: number;
  source_warehouse_name: string;
  destination_warehouse_id: number;
  destination_warehouse_name: string;
  comment: string | null;
  planned_date: string | null;
  started_at: string | null;
  received_at: string | null;
  created_at: string;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_by_login: string | null;
  received_by_user_id: number | null;
  received_by_name: string | null;
  received_by_login: string | null;
  line_count: number;
  /** Sum of line qty (for list UI) */
  total_qty: string;
};

export type TransferLineRow = {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  qty: string;
  received_qty: string | null;
  batch_no: string | null;
  comment: string | null;
  sort_order: number;
};

export type TransferDetail = {
  id: number;
  number: string;
  status: string;
  source_warehouse_id: number;
  source_warehouse_name: string;
  destination_warehouse_id: number;
  destination_warehouse_name: string;
  comment: string | null;
  planned_date: string | null;
  started_at: string | null;
  received_at: string | null;
  created_at: string;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_by_login: string | null;
  received_by_user_id: number | null;
  received_by_name: string | null;
  received_by_login: string | null;
  lines: TransferLineRow[];
};

export type TransferPdfResult = {
  buffer: Buffer;
  filename: string;
};

export type ReceiveAdjustment = {
  product_id: number;
  received_qty?: number | null;
};
