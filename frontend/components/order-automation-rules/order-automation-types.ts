export type ConsignmentMode = "all" | "yes" | "no";
export type ExecutionType = "instant" | "exact_time" | "business_days_n";
export type SourceChannel = "web" | "mobile";

export type AutomationRuleRow = {
  id: number;
  name: string;
  currency_code: string;
  amount_from: number | null;
  amount_to: number | null;
  agent_id: number | null;
  agent_user_ids?: number[];
  agent_name: string | null;
  warehouse_ids: number[];
  warehouse_names: string[];
  payment_method_ref: string | null;
  trade_direction_ref: string | null;
  trade_direction_refs?: string[];
  territory_refs: string[];
  zones: string[];
  regions: string[];
  cities: string[];
  consignment_mode: ConsignmentMode;
  comment: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  request_type_refs?: string[];
  source_channels?: SourceChannel[];
  execution_type?: ExecutionType;
  execution_time?: string | null;
  n_value?: number | null;
};

export type RuleFormState = {
  name: string;
  currency_code: string;
  amount_from: string;
  amount_to: string;
  agent_user_ids: string[];
  warehouse_ids: string[];
  payment_method_ref: string;
  trade_direction_refs: string[];
  territory_refs: string[];
  consignment_mode: ConsignmentMode;
  comment: string;
  is_active: boolean;
  request_type_refs: string[];
  source_channels: SourceChannel[];
  execution_type: ExecutionType;
  execution_time: string;
  n_value: string;
};

export const emptyRuleForm = (): RuleFormState => ({
  name: "",
  currency_code: "UZS",
  amount_from: "",
  amount_to: "",
  agent_user_ids: [],
  warehouse_ids: [],
  payment_method_ref: "",
  trade_direction_refs: [],
  territory_refs: [],
  consignment_mode: "all",
  comment: "",
  is_active: true,
  request_type_refs: [],
  source_channels: [],
  execution_type: "instant",
  execution_time: "",
  n_value: ""
});

export function formFromRow(row: AutomationRuleRow, autoConfirm: boolean): RuleFormState {
  return {
    name: row.name,
    currency_code: row.currency_code,
    amount_from: row.amount_from != null ? String(row.amount_from) : "",
    amount_to: row.amount_to != null ? String(row.amount_to) : "",
    agent_user_ids: (row.agent_user_ids ?? (row.agent_id != null ? [row.agent_id] : [])).map(String),
    warehouse_ids: row.warehouse_ids.map(String),
    payment_method_ref: row.payment_method_ref ?? "",
    trade_direction_refs: (row.trade_direction_refs?.length
      ? row.trade_direction_refs
      : row.trade_direction_ref
        ? [row.trade_direction_ref]
        : []
    ).map(String),
    territory_refs: [...row.territory_refs],
    consignment_mode: row.consignment_mode,
    comment: row.comment,
    is_active: row.is_active,
    request_type_refs: autoConfirm ? [...(row.request_type_refs ?? [])] : [],
    source_channels: autoConfirm ? [...(row.source_channels ?? [])] : [],
    execution_type: row.execution_type ?? "instant",
    execution_time: row.execution_time ? row.execution_time.slice(0, 5) : "",
    n_value: row.n_value != null ? String(row.n_value) : ""
  };
}

export function formToApiBody(form: RuleFormState, autoConfirm: boolean) {
  return {
    name: form.name.trim(),
    is_active: form.is_active,
    comment: form.comment.trim() || null,
    currency_code: form.currency_code,
    amount_from: form.amount_from.trim() ? Number(form.amount_from) : null,
    amount_to: form.amount_to.trim() ? Number(form.amount_to) : null,
    scope_agent_user_ids: form.agent_user_ids
      .map((id) => Number.parseInt(id, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
    scope_warehouse_ids: form.warehouse_ids
      .map((id) => Number.parseInt(id, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
    scope_territory_refs: form.territory_refs,
    payment_method_ref: form.payment_method_ref.trim() || null,
    scope_trade_direction_refs: form.trade_direction_refs,
    trade_direction_ref: form.trade_direction_refs[0]?.trim() || null,
    consignment_mode: form.consignment_mode,
    ...(autoConfirm
      ? {
          request_type_refs: form.request_type_refs,
          source_channels: form.source_channels,
          execution_type: form.execution_type,
          execution_time: form.execution_time.trim()
            ? form.execution_time.trim().length === 5
              ? `${form.execution_time.trim()}:00`
              : form.execution_time.trim()
            : null,
          n_value: form.n_value.trim() ? Number.parseInt(form.n_value, 10) : null
        }
      : {})
  };
}
