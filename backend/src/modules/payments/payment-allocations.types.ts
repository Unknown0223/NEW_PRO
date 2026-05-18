export type PaymentAllocationRow = {
  id: number;
  payment_id: number;
  order_id: number;
  order_number: string;
  amount: string;
  created_at: string;
};

export type AllocationMode = "cash" | "consignment" | "none";

export type OpenAllocationOrderRow = {
  order_id: number;
  order_number: string;
  created_at: string;
  consignment_due_date: string | null;
  is_consignment: boolean;
  outstanding: string;
};

export type AgingBucket = {
  client_id: number;
  client_name: string;
  total_orders: string;
  total_payments: string;
  outstanding: string;
  current: string;
  bucket_30: string;
  bucket_60: string;
  bucket_90: string;
  bucket_120: string;
};

export type ClientAgingOptions = {
  asOf?: Date | string;
};
