export type LinkageSelectedMasters = {
  selected_client_id?: number | null;
  selected_agent_id?: number | null;
  selected_warehouse_id?: number | null;
  selected_cash_desk_id?: number | null;
  selected_expeditor_user_id?: number | null;
};

export type LinkageConstraintScope = {
  selected_client_id: number | null;
  selected_agent_id: number | null;
  selected_warehouse_id: number | null;
  selected_cash_desk_id: number | null;
  selected_expeditor_user_id: number | null;
  constrained: boolean;
  client_ids: number[];
  agent_ids: number[];
  warehouse_ids: number[];
  cash_desk_ids: number[];
  expeditor_ids: number[];
  product_ids: number[];
  product_restricted: boolean;
};

export type ClientAddressTerritoryInput = {
  latitude: unknown;
  longitude: unknown;
  region: string | null;
  city: string | null;
  district: string | null;
  zone: string | null;
};
