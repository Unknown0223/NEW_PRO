import type { Prisma } from "@prisma/client";
import type { ClientBalanceListQuery } from "../client-balances/client-balances.service";

export type OrderDebtsListQuery = ClientBalanceListQuery & {
  warehouse_ids?: number[];
  explicit_client_ids?: number[];
  shipment_date_from?: string;
  shipment_date_to?: string;
  order_consignment_due_from?: string;
  order_consignment_due_to?: string;
  order_payment_ref?: string;
  order_consignment?: "all" | "consignment" | "regular";
};

export type OrderDebtRow = {
  order_id: number;
  order_number: string;
  order_status: string;
  client_id: number;
  client_name: string;
  currency: string;
  address: string | null;
  landmark: string | null;
  phone: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  expeditor_user_id: number | null;
  expeditor_name: string | null;
  expeditor_code: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  total_sum: string;
  allocated_sum: string;
  payment_method_label: string | null;
  shipped_at: string | null;
  consignment_due_date: string | null;
  remainder: string;
  unallocated: string;
  client_balance: string;
};

export type OrderDebtsListResponse = {
  data: OrderDebtRow[];
  total: number;
  page: number;
  limit: number;
  summary: { total_remainder: string; currency: string };
};

export type RawOrderDebtRow = {
  order_id: unknown;
  order_number: string;
  order_status: string;
  client_id: unknown;
  client_name: string;
  currency: string;
  address: string | null;
  landmark: string | null;
  phone: string | null;
  agent_id: unknown;
  agent_name: string | null;
  agent_code: string | null;
  expeditor_user_id: unknown;
  expeditor_name: string | null;
  expeditor_code: string | null;
  warehouse_id: unknown;
  warehouse_name: string | null;
  total_sum: Prisma.Decimal;
  allocated_sum: Prisma.Decimal;
  payment_method_ref: string | null;
  shipped_at: Date | null;
  consignment_due_date: Date | null;
  remainder: Prisma.Decimal;
  client_balance: Prisma.Decimal;
};
