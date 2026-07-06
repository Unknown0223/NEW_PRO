import { api } from "@/lib/api";

export type PlanningDirection = { id: number; name: string; code: string | null };
export type PlanningKpiGroup = {
  id: number;
  name: string;
  trade_direction_id: number;
  status: string | null;
};
export type PlanningEmployee = {
  id: number;
  name: string;
  code: string | null;
  role: string;
  parent_id: number | null;
  supervisor_config_index?: number | null;
  chain_level?: number | null;
};
export type PlanningPlan = {
  id: number;
  month: number;
  year: number;
  trade_direction_id: number;
  kpi_group_id: number;
  status: string;
};
export type PlanningTarget = {
  id: number;
  plan_id: number;
  user_id: number;
  cost: string;
  count: string;
  volume: string;
  acb: string;
  order_count: number;
  comment: string | null;
  status: string;
  updated_at: string;
};

export type PlanningCenterData = {
  trade_directions: PlanningDirection[];
  kpi_groups: PlanningKpiGroup[];
  employees: PlanningEmployee[];
  plans: PlanningPlan[];
  kpi_targets: PlanningTarget[];
};

/** API javobidagi id/parent_id ni raqamga keltiradi (daraxt `===` bog‘lanishi buzilmasin). */
export function normalizePlanningEmployees(employees: PlanningEmployee[]): PlanningEmployee[] {
  return employees.map((e) => {
    const parentRaw = e.parent_id;
    const parent_id =
      parentRaw == null || parentRaw === ("" as unknown)
        ? null
        : Number(parentRaw);
    return {
      ...e,
      id: Number(e.id),
      parent_id: parent_id != null && Number.isFinite(parent_id) ? parent_id : null,
      supervisor_config_index:
        e.supervisor_config_index == null ? null : Number(e.supervisor_config_index),
      chain_level: e.chain_level == null ? null : Number(e.chain_level)
    };
  });
}

export type PatchTargetPayload = Partial<{
  cost: string;
  count: string;
  volume: string;
  acb: string;
  order_count: number;
  comment: string | null;
  status: string;
}>;

export const planningKeys = {
  center: (tenantSlug: string | null, month: number, year: number, directionId: number | null) =>
    ["plans", "setup", tenantSlug, month, year, directionId] as const
};

export async function fetchPlanningDirections(
  tenantSlug: string
): Promise<PlanningDirection[]> {
  const { data } = await api.get<{ data: PlanningDirection[] }>(
    `/api/${tenantSlug}/trade-directions?is_active=true`
  );
  return data.data;
}

export async function fetchPlanningCenter(
  tenantSlug: string,
  month: number,
  year: number,
  directionId: number
): Promise<PlanningCenterData> {
  const qs = new URLSearchParams({
    month: String(month),
    year: String(year),
    direction_id: String(directionId)
  });
  const { data } = await api.get<{ data: PlanningCenterData }>(
    `/api/${tenantSlug}/plans/setup?${qs.toString()}`
  );
  return {
    ...data.data,
    employees: normalizePlanningEmployees(data.data.employees)
  };
}

export async function patchPlanningTarget(
  tenantSlug: string,
  targetId: number,
  payload: PatchTargetPayload
): Promise<PlanningTarget> {
  const { data } = await api.patch<{ data: PlanningTarget }>(
    `/api/${tenantSlug}/plans/setup/targets/${targetId}`,
    payload
  );
  return data.data;
}

export async function confirmPlanningPlans(
  tenantSlug: string,
  month: number,
  year: number,
  directionId: number,
  planIds?: number[]
): Promise<{ plans_updated: number; targets_updated: number }> {
  const qs = new URLSearchParams({
    month: String(month),
    year: String(year),
    direction_id: String(directionId)
  });
  const { data } = await api.post<{ data: { plans_updated: number; targets_updated: number } }>(
    `/api/${tenantSlug}/plans/setup/confirm?${qs.toString()}`,
    planIds && planIds.length > 0 ? { plan_ids: planIds } : {}
  );
  return data.data;
}

export async function approvePlanningPlans(
  tenantSlug: string,
  month: number,
  year: number,
  directionId: number,
  planIds?: number[]
): Promise<{ plans_updated: number; targets_updated: number }> {
  const qs = new URLSearchParams({
    month: String(month),
    year: String(year),
    direction_id: String(directionId)
  });
  const { data } = await api.post<{ data: { plans_updated: number; targets_updated: number } }>(
    `/api/${tenantSlug}/plans/setup/approve?${qs.toString()}`,
    planIds && planIds.length > 0 ? { plan_ids: planIds } : {}
  );
  return data.data;
}

export async function returnPlanningPlansToDraft(
  tenantSlug: string,
  month: number,
  year: number,
  directionId: number,
  planIds?: number[]
): Promise<{ plans_updated: number; targets_updated: number }> {
  const qs = new URLSearchParams({
    month: String(month),
    year: String(year),
    direction_id: String(directionId)
  });
  const { data } = await api.post<{ data: { plans_updated: number; targets_updated: number } }>(
    `/api/${tenantSlug}/plans/setup/return?${qs.toString()}`,
    planIds && planIds.length > 0 ? { plan_ids: planIds } : {}
  );
  return data.data;
}
