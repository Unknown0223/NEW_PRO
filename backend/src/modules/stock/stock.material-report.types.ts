export type MaterialReportRow = {
  product_id: number;
  sku: string;
  product_name: string;
  category_name: string | null;
  beginning_stock: string;
  incoming_receipt: string;
  correction_plus: string;
  return_from_shelf: string;
  inventory_plus: string;
  transfer_plus: string;
  partial_return: string;
  sale_out: string;
  supplier_return: string;
  correction_minus: string;
  bonus_out: string;
  writeoff_out: string;
  transfer_minus: string;
  inventory_minus: string;
  canceled_receipt: string;
  ending_stock: string;
  volume_m3: string;
};

export type MaterialReportOpts = {
  date_from: string;
  date_to: string;
  warehouse_id?: number;
  category_id?: number;
  product_id?: number;
  q?: string;
  qty_mode?: "all" | "positive" | "zero";
  page: number;
  limit: number;
};

export type MaterialReportExportOpts = Omit<MaterialReportOpts, "page" | "limit"> & {
  mode?: "detailed" | "summary";
};
