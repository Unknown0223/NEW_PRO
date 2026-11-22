export type SalesProDetailView =
  | { kind: "plan" }
  | { kind: "sales" }
  | { kind: "okb" }
  | { kind: "categories" }
  | { kind: "branches" }
  | { kind: "directions" }
  | { kind: "agents" }
  | { kind: "dynamics" }
  | { kind: "allocation" };

export type SalesProDayPoint = {
  label: string;
  plan: number;
  fact: number;
  completion: number;
};

export type SalesProCategoryRow = {
  name: string;
  amount: number;
  pct: number;
  color: string;
};

export type SalesProBranchRow = {
  id: string;
  name: string;
  akb: number;
  okb: number;
  plan: number;
  fact: number;
  completion: number | null;
};

export type SalesProDirectionRow = {
  id: string;
  name: string;
  plan: number;
  fact: number;
  completion: number | null;
  color: string;
};

export type SalesProAgentRow = {
  id: string;
  name: string;
  akb: number;
  plan: number;
  fact: number;
  completion: number | null;
  ordersCount: number;
};

export type SalesProUiModel = {
  plan: number;
  fact: number;
  completionPct: number | null;
  akb: number;
  okb: number;
  coveragePct: number;
  days: SalesProDayPoint[];
  categoryRows: SalesProCategoryRow[];
  branchRows: SalesProBranchRow[];
  directionRows: SalesProDirectionRow[];
  agentRows: SalesProAgentRow[];
  averageTicket: number;
  periodLabel: string;
  planNote: string;
  ordersCount: number;
  deliveredOrdersCount: number;
};

export type SalesProPageProps = {
  model: SalesProUiModel;
  loading?: boolean;
  monthLabel: string;
};
