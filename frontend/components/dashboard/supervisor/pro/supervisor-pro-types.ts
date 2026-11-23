import type { ReactNode } from "react";

export type SupervisorProCatalogTab = "categories" | "groups" | "brands";

export type SupervisorProDetailView =
  | { kind: "payment"; id: string }
  | { kind: "visits" }
  | { kind: "catalog"; tab: SupervisorProCatalogTab; id: string };

export type SupervisorProPaymentRow = {
  id: string;
  name: string;
  amount: number;
  sharePct: number;
  color: string;
};

export type SupervisorProStatCard = {
  id: "visits" | "success" | "gps" | "photos";
  name: string;
  plan: number;
  fact: number;
  pct: number;
};

export type SupervisorProCatalogRow = {
  id: string;
  name: string;
  amount: number;
  volume: number;
  pct: number;
  akb: number;
  avgCheck: number;
  color: string;
};

export type SupervisorProAgentVisitRow = {
  id: string;
  name: string;
  code: string | null;
  supervisor: string;
  plan: number;
  fact: number;
  success: number;
  gps: number;
  photos: number;
  photoOutlets: number;
  completion: number;
  sales: number;
};

export type SupervisorProInsight = {
  text: string;
  color: string;
  tone: "good" | "info" | "warn";
};

export type SupervisorProUiModel = {
  dateLabel: string;
  monthProgressPct: number;
  daysLeft: number;
  planApproved: number;
  planPending: number | null;
  mtdFact: number;
  completionPct: number | null;
  forecastTrendUp: boolean;
  averageTicket: number;
  neededPerDay: number;
  paymentTotal: number;
  methodRows: SupervisorProPaymentRow[];
  statCards: SupervisorProStatCard[];
  visitsToday: number;
  photoPendingHint: number;
  agentCount: number;
  catalogByTab: Record<SupervisorProCatalogTab, SupervisorProCatalogRow[]>;
  agentVisitRows: SupervisorProAgentVisitRow[];
  insights: SupervisorProInsight[];
};

export type SupervisorProFilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

export type SupervisorProFilterKey =
  | "payment_types"
  | "agent_ids"
  | "supervisor_ids"
  | "trade_directions"
  | "client_categories"
  | "territory_1_list"
  | "territory_2_list"
  | "territory_3_list";

export type SupervisorProFiltersProps = {
  date: string;
  draft: Record<SupervisorProFilterKey, string[]>;
  applied: Record<SupervisorProFilterKey, string[]>;
  options: Record<SupervisorProFilterKey, SupervisorProFilterOption[]>;
  onDateChange: (ymd: string) => void;
  onDraftChange: (key: SupervisorProFilterKey, values: string[]) => void;
  onApply: () => void;
  onReset: () => void;
  datePickerSlot?: ReactNode;
};

export type SupervisorProPageProps = {
  model: SupervisorProUiModel;
  loading?: boolean;
  filtersSlot: ReactNode;
  /** agentId — ochilganda shu agent foto-reporti; bo‘sh — eng ko‘p fotoli agent */
  onOpenPhotos: (agentId?: string) => void;
};
