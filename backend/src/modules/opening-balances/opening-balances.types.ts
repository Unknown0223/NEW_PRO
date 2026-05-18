export type OpeningBalanceListQuery = {
  page: number;
  limit: number;
  date_from?: string;
  date_to?: string;
  /** created_at | paid_at */
  date_field?: "created_at" | "paid_at";
  client_ids?: number[];
  payment_type?: string;
  trade_direction?: string;
  agent_id?: number;
  cash_desk_ids?: number[];
  balance_type?: "debt" | "surplus";
  amount_min?: number;
  amount_max?: number;
  search?: string;
  /** true — faqat arxiv (yumshoq o‘chirilgan) */
  archive?: boolean;
};

export type OpeningBalanceListRow = {
  id: number;
  created_at: string;
  client_id: number;
  client_name: string;
  agent_id: number | null;
  agent_name: string | null;
  trade_direction: string | null;
  cash_desk_name: string | null;
  balance_type: string;
  balance_type_label: string;
  payment_type: string;
  amount: string;
  note: string | null;
  paid_at: string | null;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_name: string | null;
  delete_reason_ref: string | null;
};

export type CreateOpeningBalanceInput = {
  client_id: number;
  balance_type: "debt" | "surplus";
  amount: number;
  payment_type: string;
  cash_desk_id?: number | null;
  trade_direction?: string | null;
  note?: string | null;
  paid_at?: string | null;
};
