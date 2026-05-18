import type { Prisma } from "@prisma/client";

export type ExpeditorReturnsDateType = "order_date" | "created_date" | "shipped_date";

export type ExpeditorReturnsApplicationType = "all" | "returns_only";

export type ExpeditorReturnsUnitMode = "qty" | "pack" | "volume" | "weight";

export type ExpeditorReturnsFilters = {
  date_type: ExpeditorReturnsDateType;
  from: string;
  to: string;
  application_type: ExpeditorReturnsApplicationType;
  agent_ids?: number[];
  expeditor_ids?: number[];
  category_ids?: number[];
  payment_methods?: string[];
  statuses?: string[];
  consignment: "all" | "yes" | "no";
  territory_1_list?: string[];
  territory_2_list?: string[];
  territory_3_list?: string[];
  warehouse_id?: number;
  search?: string;
  /** «По товарам» qidiruv */
  search_products?: string;
  /** «По клиентам» qidiruv */
  search_clients?: string;
  page: number;
  limit: number;
  sort_by: "order_id" | "order_date" | "client_name" | "return_qty";
  unit_mode: ExpeditorReturnsUnitMode;
  /** API: max qator; `null` — limit yo‘q (eksport) */
  agg_products_limit: number | null;
  agg_clients_limit: number | null;
};

export type OrderRowRaw = {
  id: number;
  number: string;
  order_type: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  shipped_at: Date | null;
  delivered_at: Date | null;
  total_sum: Prisma.Decimal;
  bonus_sum: Prisma.Decimal;
  request_type_ref: string | null;
  client_name: string;
  agent_label: string | null;
  expeditor_label: string | null;
  qty_ordered: Prisma.Decimal;
  qty_bonus_ordered: Prisma.Decimal;
  return_qty_effective: Prisma.Decimal;
  return_bonus_effective: Prisma.Decimal;
  refund_sum: Prisma.Decimal;
  refusal_reasons: string | null;
  delivered_qty: Prisma.Decimal;
  extra_order_qty: Prisma.Decimal;
  bonus_delivery_qty: Prisma.Decimal;
  bonus_delivery_sum: Prisma.Decimal;
};
