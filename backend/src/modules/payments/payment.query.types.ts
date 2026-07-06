import type { PaymentAllocationRow } from "./payment-allocations.service";

export type PaymentListRow = {
  id: number;
  client_id: number;
  client_name: string;
  /** Yuridik nom */
  client_legal_name: string | null;
  client_code: string | null;
  client_balance: string;
  order_id: number | null;
  order_number: string | null;
  cash_desk_id: number | null;
  amount: string;
  payment_type: string;
  note: string | null;
  created_at: string;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  trade_direction: string | null;
  /** Mijoz agenti konsignatsiya rejimida */
  consignment: boolean;
  expeditor_user_id: number | null;
  expeditor_name: string | null;
  /** To'lov mobil ekspeditor ilovasida yaratilgan (yozuvda expeditor_user_id bor) */
  created_via_mobile: boolean;
  cash_desk_name: string | null;
  /** Doimiy: mijoz balansiga kirim / «Расход» */
  payment_kind: string;
  /** payment | client_expense */
  entry_kind: string;
  workflow_status: string;
  paid_at: string | null;
  received_at: string | null;
  confirmed_at: string | null;
  /** «Отклонено» (rejected) holatida — to'g'rilash taymeri tugash vaqti (faol grant). */
  return_expires_at: string | null;
  /** Mijoz manzili / hudud (chek guruhlash) */
  client_region: string | null;
  client_city: string | null;
  client_district: string | null;
  /** Arxiv (yumshoq bekor) */
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_name: string | null;
  delete_reason_ref: string | null;
};

export type PaymentDetailRow = PaymentListRow & {
  created_by_user_id: number | null;
  created_by_name: string | null;
};

export type PaymentDetailPayload = {
  payment: PaymentDetailRow;
  allocations: PaymentAllocationRow[];
  allocated_total: string;
  unallocated: string;
};

/** `sort_by` query — jadval ustuni identifikatori bilan mos */
export type PaymentListSortKey =
  | "payment_id"
  | "paid_at"
  | "created_at"
  | "confirmed_at"
  | "amount"
  | "payment_type"
  | "note"
  | "client_name"
  | "order_id"
  | "agent"
  | "trade_direction"
  | "consignment"
  | "expeditor"
  | "territory"
  | "last_change"
  | "changed_by";

/** Ro‘yxat / filtrlash (GET /payments) */
export type PaymentListQuery = {
  page: number;
  limit: number;
  client_id?: number;
  client_ids?: number[];
  order_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  amount_min?: number;
  amount_max?: number;
  agent_id?: number;
  /** Bir nechta agent (mijoz.agent_id) */
  agent_ids?: number[];
  expeditor_user_id?: number;
  expeditor_user_ids?: number[];
  payment_type?: string;
  trade_direction?: string;
  territory_region?: string;
  territory_city?: string;
  territory_district?: string;
  territory_zone?: string;
  /** Mijozning agenti: `regular` — agent yo‘q yoki consignment=false; `consignment` — agent.consignment=true */
  deal_type?: "regular" | "consignment" | "both";
  /** Filtr: `deleted` — faqat arxiv (deleted_at bor); `rejected` — rad etilgan ariza */
  payment_status?: "pending_confirmation" | "confirmed" | "deleted" | "rejected";
  /**
   * «Заявки на оплату» kanali (heuristika `payment_type` / `note` / agent yo‘nalishi).
   * `expeditor` — zakaz yoki to‘lovdagi ekspeditor bog‘langan.
   */
  application_channel?: "expeditor" | "collector" | "van" | "bank";
  cash_desk_ids?: number[];
  warehouse_ids?: number[];
  /** payment — faqat to‘lovlar; client_expense — «расходы клиента» */
  entry_kind?: "payment" | "client_expense" | "discount_settlement";
  /** Sanani qaysi maydonga qo‘llash (filtr) */
  date_field?: "created_at" | "paid_at" | "confirmed_at";
  /** GET /payments ro‘yxati tartibi (whitelist) */
  sort_by?: PaymentListSortKey;
  sort_dir?: "asc" | "desc";
};
export type UpdatePaymentInput = {
  amount?: number;
  payment_type?: string;
  note?: string | null;
  cash_desk_id?: number | null;
  paid_at?: string | null;
  order_id?: number | null;
  expeditor_user_id?: number | null;
  ledger_agent_id?: number | null;
};
