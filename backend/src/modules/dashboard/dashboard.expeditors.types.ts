export type ExpeditorsDashboardFilters = {
  /** YYYY-MM-DD */
  date_from: string;
  /** YYYY-MM-DD */
  date_to: string;
  expeditor_ids: number[];
  agent_ids: number[];
  supervisor_ids: number[];
  branches: string[];
};

export type ExpeditorDashboardRow = {
  expeditor_user_id: number;
  expeditor_name: string;
  expeditor_code: string | null;
  total_orders: number;
  delivered_orders: number;
  delivered_sum: string;
  returned_orders: number;
  returned_sum: string;
  payments_collected: string;
  debt: string;
};

export type ExpeditorStatusRow = {
  name: string;
  code: string | null;
  delivered_orders: number;
  delivered_sum: string;
  by_status: Record<string, string>;
  by_status_days: Record<string, number>;
};

export type ExpeditorGroupRow = {
  name: string;
  code: string | null;
  delivered_orders: number;
  delivered_sum: string;
  returned_sum: string;
  payments_collected: string;
  debt: string;
};

export type ExpeditorsDashboardResponse = {
  date_from: string;
  date_to: string;
  rows: ExpeditorDashboardRow[];
  totals: {
    expeditors_count: number;
    total_orders: number;
    delivered_orders: number;
    delivered_sum: string;
    returned_orders: number;
    returned_sum: string;
    payments_collected: string;
    debt: string;
  };
  expeditors: Array<{ id: number; name: string; code: string | null }>;
  agents: Array<{ id: number; name: string; code: string | null }>;
  supervisors: Array<{ id: number; name: string; code: string | null }>;
  branches: string[];
  by_filial: ExpeditorGroupRow[];
  by_supervisor: ExpeditorGroupRow[];
  by_agent: ExpeditorGroupRow[];
  status_by: Record<"filial" | "supervisor" | "agent" | "expeditor", ExpeditorStatusRow[]>;
};
