export type ReturnInvoiceRow = {
  id: string;
  courier_id: number;
  courier_name: string | null;
  creation_channel: "web" | "mobile";
  date: string;
  created_at: string;
  warehouse_name: string;
  warehouse_count: number;
  return_count: number;
  item_count: number;
  total_qty: number;
  refund_total: string;
  status: "pending" | "posted" | "cancelled";
  pending_count: number;
  accepted_at: string | null;
};

export const RETURN_INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает приёмки",
  posted: "Принят",
  cancelled: "Отклонён"
};

export function formatReturnInvoiceQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}
