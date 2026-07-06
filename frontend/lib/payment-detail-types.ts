import type { PaymentListApiRow } from "@/lib/payment-list-types";

export type PaymentAllocationRow = {
  id: number;
  payment_id: number;
  order_id: number;
  order_number: string;
  amount: string;
  created_at: string;
};

export type PaymentDetailRow = PaymentListApiRow & {
  created_by_user_id?: number | null;
  created_by_name?: string | null;
};

export type PaymentDetailPayload = {
  payment: PaymentDetailRow;
  allocations: PaymentAllocationRow[];
  allocated_total: string;
  unallocated: string;
};
