/** Backend `work-slots` moduli bilan mos tiplar (frontend). */

export const WORK_SLOT_TYPES = [
  "agent",
  "collector",
  "expeditor",
  "skladchik",
  "supervisor",
  "auditor"
] as const;

export type WorkSlotType = (typeof WORK_SLOT_TYPES)[number];

export type WorkSlotEntitlements = {
  price_types?: string[];
  product_rules?: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
  mobile_config?: unknown;
  [key: string]: unknown;
};

export type WorkSlotListItem = {
  id: number;
  slot_code: string;
  label: string | null;
  branch_code: string | null;
  direction_id: number | null;
  direction_name: string | null;
  slot_type: string;
  is_active: boolean;
  sort_order: number;
  active_user_id: number | null;
  active_user_name: string | null;
  active_user_territory: string | null;
  active_territory_zone: string | null;
  active_territory_oblast: string | null;
  active_territory_city: string | null;
  active_warehouse_id: number | null;
  active_warehouse_name: string | null;
  return_warehouse_id: number | null;
  return_warehouse_name: string | null;
  active_cash_desk_id: number | null;
  active_cash_desk_names: string | null;
  price_type: string | null;
  price_types: string[];
  entitlements: WorkSlotEntitlements;
  consignment: boolean;
  consignment_limit_amount: string | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
  warehouse_staff_entitlements: Record<string, boolean>;
  expeditor_assignment_rules: Record<string, unknown>;
  active_since: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkSlotListResponse = {
  data: WorkSlotListItem[];
  total: number;
};

export type AssignChecklist = {
  cash_desk_conflicts: Array<{ cash_desk_id: number; cash_desk_name: string; other_user_id: number }>;
  clients_affected_estimate: number;
  locked_clients_skipped: number;
  slot_has_active_user: boolean;
  active_user_id: number | null;
};

export type SlotHistoryItem = {
  id: number;
  prev_user_name: string | null;
  next_user_name: string | null;
  action: string;
  actor_name: string | null;
  note: string | null;
  created_at: string;
};

export type StaffPick = {
  id: number;
  fio: string;
  code: string | null;
};

export type WorkSlotsFilters = {
  branch_code: string;
  slot_types: WorkSlotType[];
  is_active: boolean | null;
  q: string;
  page: number;
  limit: number;
};

export type WorkSlotActivityRow = {
  link_id: number;
  slot_id: number;
  slot_code: string;
  slot_type: string;
  branch_code: string | null;
  user_id: number;
  user_name: string;
  started_at: string;
  ended_at: string | null;
  days_on_slot: number;
};

export type WorkSlotActivityReport = {
  date_from: string;
  date_to: string;
  rows: WorkSlotActivityRow[];
  total: number;
};
