import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";

export type SupplierPaymentSortKey =
  | "created_at"
  | "paid_at"
  | "amount"
  | "supplier_name"
  | "payment_method"
  | "cash_desk_name"
  | "created_by_name"
  | "id";

export type ListSupplierPaymentsOpts = {
  supplier_id?: number;
  cash_desk_id?: number;
  payment_method?: string | null;
  paid_from?: Date | null;
  paid_to?: Date | null;
  amount_from?: number | null;
  amount_to?: number | null;
  include_reversed?: boolean;
  search?: string | null;
  page: number;
  limit: number;
  sort_dir?: "asc" | "desc";
  sort_by?: SupplierPaymentSortKey;
};
