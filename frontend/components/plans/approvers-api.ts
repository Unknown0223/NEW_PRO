import { api } from "@/lib/api";

export type ApproverPerson = { id: number; name: string; role: string };
export type ApproverDirection = { id: number; name: string; code: string | null };

export type ApproverOptions = {
  directions: ApproverDirection[];
  supervisors: ApproverPerson[];
  employees: ApproverPerson[];
  leaders: ApproverPerson[];
};

export type ApproverConfigRow = {
  supervisor_user_id: number;
  supervisor_name: string;
  levels: (number | null)[];
};

export type ApproverConfig = {
  rows: ApproverConfigRow[];
  leaders: number[];
};

export type SaveApproverPayload = {
  rows: { supervisor_user_id: number; levels: (number | null)[] }[];
  leaders: number[];
};

/** «Главный утверждающий» — SVR ustidagi rollar (Степень bilan bir xil). */
const APPROVER_LEADER_ROLE_VALUES = new Set([
  "director",
  "sales_director",
  "commercial_director",
  "admin",
  "manager",
  "regional_manager"
]);

/** «Степень» va «Главный утверждающий» uchun birlashtirilgan tanlovlar. */
export function mergeApproverLeaderOptions(options: ApproverOptions): ApproverPerson[] {
  const byId = new Map<number, ApproverPerson>();
  for (const p of options.leaders) byId.set(p.id, p);
  for (const p of options.employees) {
    if (APPROVER_LEADER_ROLE_VALUES.has(p.role) && !byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export const approverKeys = {
  options: (tenantSlug: string | null, directionId: number | null) =>
    ["plans", "approvers", "options", tenantSlug, directionId] as const,
  config: (tenantSlug: string | null, directionId: number | null) =>
    ["plans", "approvers", "config", tenantSlug, directionId] as const
};

export async function fetchApproverOptions(
  tenantSlug: string,
  directionId: number | null
): Promise<ApproverOptions> {
  const qs = directionId != null ? `?direction_id=${directionId}` : "";
  const { data } = await api.get<{ data: ApproverOptions }>(
    `/api/${tenantSlug}/plans/approvers/options${qs}`
  );
  return data.data;
}

export async function fetchApproverConfig(
  tenantSlug: string,
  directionId: number
): Promise<ApproverConfig> {
  const { data } = await api.get<{ data: ApproverConfig }>(
    `/api/${tenantSlug}/plans/approvers?direction_id=${directionId}`
  );
  return data.data;
}

export async function saveApproverConfig(
  tenantSlug: string,
  directionId: number,
  payload: SaveApproverPayload
): Promise<ApproverConfig> {
  const { data } = await api.put<{ data: ApproverConfig }>(
    `/api/${tenantSlug}/plans/approvers?direction_id=${directionId}`,
    payload
  );
  return data.data;
}
