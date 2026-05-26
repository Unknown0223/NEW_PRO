export type ReturnFilterPeriodUnit = "day" | "month";

export type ReturnFilterSettings = {
  period_enabled: boolean;
  period_unit: ReturnFilterPeriodUnit;
  period_value: number;
  balance_zero_enabled: boolean;
};

export type ReturnFilterEmptyReason =
  | "balance_zero_not_in_period"
  | "balance_zero_required";

export type ReturnEligibleWindow = {
  empty: boolean;
  empty_reason?: ReturnFilterEmptyReason;
  /** Zakaz `created_at` uchun inclusive past chegara */
  min_order_created_at?: Date;
  max_order_created_at: Date;
  period_from?: Date | null;
  balance_zero_at?: Date | null;
  settings: ReturnFilterSettings;
};

export type ReturnFilterMode =
  | "period_only"
  | "balance_zero_only"
  | "period_and_balance_zero"
  | "none";

export type ReturnFilterMeta = {
  period_from: string | null;
  balance_zero_at: string | null;
  empty_reason: ReturnFilterEmptyReason | null;
  period_enabled: boolean;
  balance_zero_enabled: boolean;
  /** Qaysi filtr rejimi ishlatilmoqda */
  filter_mode?: ReturnFilterMode;
  /** Joriy ko‘rinadigan balans (l/s + yetkazilgan qarz) — «Финансы» bilan bir xil */
  client_balance?: string | null;
  /** Faqat l/s jurnal (client_balances) */
  ledger_balance?: string | null;
  /** Yetkazilgan, to‘lanmagan zakazlar summasi */
  unpaid_delivered_total?: string | null;
  /** Zakaz+to‘lov ledger yig‘indisi (balans 0 qidiruv manbasi) */
  ledger_net_balance?: string | null;
  /** Davr ichidagi yetkazilgan zakazlar soni (davr yoqilganda) */
  delivered_in_period?: number | null;
  /** Filtrdan o‘tgan yetkazilgan zakazlar */
  delivered_after_filter?: number;
  min_order_created_at?: string | null;
  /** Foydalanuvchi uchun qisqa tushuntirish */
  explanation?: string;
  /** Debug log qadamlari */
  log?: string[];
};
