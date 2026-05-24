export type { WorkSlotType } from "./work-slots.constants";

export type LockType = "none" | "manual" | "contract";

export type AutoAssignStatus = "assigned" | "pending_review" | "locked";

export type WorkSlotRow = {
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
  active_cash_desk_id: number | null;
  active_cash_desk_names: string | null;
  active_since: string | null;
  created_at: string;
  updated_at: string;
};

export type SlotHistoryRow = {
  id: number;
  prev_user_id: number | null;
  prev_user_name: string | null;
  next_user_id: number | null;
  next_user_name: string | null;
  action: string;
  actor_name: string | null;
  note: string | null;
  created_at: string;
};

export type AssignChecklist = {
  cash_desk_conflicts: Array<{ cash_desk_id: number; cash_desk_name: string; other_user_id: number }>;
  clients_affected_estimate: number;
  locked_clients_skipped: number;
  slot_has_active_user: boolean;
  active_user_id: number | null;
};

export type PendingAssignmentRow = {
  id: number;
  client_id: number;
  client_name: string;
  slot: number;
  agent_id: number | null;
  agent_name: string | null;
  lock_type: string;
  auto_assign_status: string;
};
