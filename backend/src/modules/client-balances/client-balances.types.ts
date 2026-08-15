export type ClientBalanceViewMode = "clients" | "agents" | "clients_delivery" | "clients_legacy";

export type ClientBalanceListQuery = {
  view: ClientBalanceViewMode;
  page: number;
  limit: number;
  /** Jadval sort ustuni (masalan `balance`, `pay:Naqd`) */
  sort_by?: string;
  /** Sort yo‘nalishi */
  sort_dir?: "asc" | "desc";
  /** Excel / to‘liq eksport — limit yuqori chegarasi */
  allow_large_export?: boolean;
  search?: string;
  agent_id?: number;
  agent_ids?: number[];
  expeditor_user_id?: number;
  expeditor_user_ids?: number[];
  supervisor_user_id?: number;
  supervisor_user_ids?: number[];
  trade_direction?: string;
  trade_directions?: string[];
  category?: string;
  categories?: string[];
  /** all | active | inactive */
  status?: string;
  statuses?: string[];
  /** all | debt | credit */
  balance_filter?: string;
  balance_filters?: string[];
  /** all | regular | consignment — agent.consignment */
  agent_consignment?: string;
  territory_region?: string;
  territory_regions?: string[];
  territory_city?: string;
  territory_cities?: string[];
  territory_district?: string;
  territory_zone?: string;
  territory_zones?: string[];
  /** YYYY-MM-DD — balans harakatlari bo‘yicha shu sanagacha (UTC kun oxiri) yig‘indi */
  balance_as_of?: string;
  /** Konsignatsiya / litsenziya muddati (client.license_until) oralig‘i */
  consignment_due_from?: string;
  consignment_due_to?: string;
  /** Agent `User.branch` (filial) */
  agent_branch?: string;
  /** Bir nechta filial (konsignatsiya hisoboti) */
  agent_branches?: string[];
  /** Mijozda shu turdagi kirim to‘lovi bo‘lganlar */
  agent_payment_type?: string;
  agent_payment_types?: string[];
  /** Konsignatsiya zakazlari: `orders.created_at` oralig‘i (YYYY-MM-DD) */
  order_date_from?: string;
  order_date_to?: string;
  /** «По доставке»: bitta zakaz ID bo‘yicha filtr */
  delivery_order_id?: number;
};

/** KPI и колонки таблицы: способ оплаты из справочника тенанта → сумма по payment_type */
export type ClientBalancePaymentTypeSummary = {
  label: string;
  amount: string;
};

export type ClientBalanceRow = {
  client_id: number;
  client_code: string | null;
  name: string;
  is_active: boolean;
  legal_name: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  agent_tags: string[];
  supervisor_name: string | null;
  trade_direction: string | null;
  inn: string | null;
  phone: string | null;
  license_until: string | null;
  days_overdue: number | null;
  last_order_at: string | null;
  last_payment_at: string | null;
  days_since_payment: number | null;
  balance: string;
  /** Eski agent(lar) unpaid delivered qoldig‘i (musbat). */
  legacy_debt?: string | null;
  /** Joriy clients.agent_id unpaid delivered qoldig‘i (musbat). */
  current_debt?: string | null;
  /** Eski qarz egasi agent(lar) nomi. */
  legacy_agent_names?: string | null;
  /** Joriy qarz egasi agent nomi. */
  current_agent_name?: string | null;
  /** Столбцы как в KPI: только справочник «способы оплаты» тенанта, тот же порядок что summary.payment_by_type */
  payment_amounts: ClientBalancePaymentTypeSummary[];
  /** «По доставке»: bir qator = bitta zakaz */
  delivery_order_id?: number | null;
  delivery_order_number?: string | null;
  /** `delivery_order_id` bilan bir xil (JSON/klientlar uchun qo‘shimcha kalit) */
  order_id?: number | null;
};

export type AgentBalanceRow = {
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  clients_count: number;
  balance: string;
  /** Faol eski agentlar qarzi (workplace agent mijozlarida). */
  legacy_debt: string;
  /** Joriy ish o‘rni agentining o‘z + bo‘shatilgan agentlar qoldiq qarzi. */
  current_debt: string;
  is_active: boolean | null;
  payment_amounts: ClientBalancePaymentTypeSummary[];
};

export type ClientBalanceListResponse = {
  view: ClientBalanceViewMode;
  data: ClientBalanceRow[] | AgentBalanceRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    balance: string;
    payment_by_type: ClientBalancePaymentTypeSummary[];
  };
};

export type ClientBalanceTerritoryOptions = {
  regions: string[];
  cities: string[];
  districts: string[];
  zones: string[];
  neighborhoods: string[];
  branches: string[];
};
