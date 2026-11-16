import { api } from "@/lib/api";
import type {
  DirectionContext,
  EmployeeSource,
  MultiProposalResult,
  ProposalConfig
} from "@salec/plans-proposal";

export type ProposalPeriod = { year: number; month: number };

export type ProposalContextData = {
  directions: Array<{ id: number; name: string; code: string | null }>;
  direction_id: number;
  target: ProposalPeriod;
  source: ProposalPeriod;
  source_meta: {
    status: "final" | "provisional";
    observedDays: number;
    daysInMonth: number;
  };
  kpi_groups: Array<{ id: number; name: string }>;
  agent_kpi_ids: Record<string, number[]>;
  kpi_group_ids_with_agents: number[];
  datasets: Array<{ kpiGroupId: number; employees: EmployeeSource[] }>;
  snapshot_hash: string;
  default_configs: Record<string, ProposalConfig>;
};

export type ProposalRecord = {
  id: number;
  version: number;
  status: string;
  target_year: number;
  target_month: number;
  source_year: number;
  source_month: number;
  trade_direction_id: number;
  config: Record<string, ProposalConfig>;
  snapshot_hash: string | null;
  rows: Array<{
    id: number;
    user_id: number;
    kpi_group_id: number;
    proposed_value: string | null;
    ready: boolean;
    excluded: boolean;
  }>;
};

export const proposalKeys = {
  context: (
    slug: string | null,
    directionId: number | null,
    target: ProposalPeriod | null,
    source: ProposalPeriod | null
  ) => ["plans", "proposals", "context", slug, directionId, target, source] as const,
  draft: (slug: string | null, directionId: number | null, target: ProposalPeriod | null) =>
    ["plans", "proposals", "draft", slug, directionId, target] as const
};

export async function fetchProposalContext(
  tenantSlug: string,
  directionId: number,
  target: ProposalPeriod,
  source?: ProposalPeriod
): Promise<ProposalContextData> {
  const qs = new URLSearchParams({
    direction_id: String(directionId),
    target_year: String(target.year),
    target_month: String(target.month)
  });
  if (source) {
    qs.set("source_year", String(source.year));
    qs.set("source_month", String(source.month));
  }
  const { data } = await api.get<{ data: ProposalContextData }>(
    `/api/${tenantSlug}/plans/proposals/context?${qs}`
  );
  return data.data;
}

export async function fetchProposalDraft(
  tenantSlug: string,
  directionId: number,
  target: ProposalPeriod
): Promise<ProposalRecord | null> {
  const qs = new URLSearchParams({
    direction_id: String(directionId),
    target_year: String(target.year),
    target_month: String(target.month)
  });
  const { data } = await api.get<{ data: ProposalRecord | null }>(
    `/api/${tenantSlug}/plans/proposals?${qs}`
  );
  return data.data;
}

export async function saveProposalDraft(
  tenantSlug: string,
  body: {
    direction_id: number;
    target: ProposalPeriod;
    source: ProposalPeriod;
    configs: Record<string, ProposalConfig>;
    name?: string;
  }
): Promise<ProposalRecord> {
  const { data } = await api.post<{ data: ProposalRecord }>(
    `/api/${tenantSlug}/plans/proposals`,
    body
  );
  return data.data;
}

export async function applyProposalDraft(
  tenantSlug: string,
  id: number,
  version: number
): Promise<unknown> {
  const { data } = await api.post(`/api/${tenantSlug}/plans/proposals/${id}/apply`, {
    version
  });
  return data.data;
}

export async function exportProposalCsv(tenantSlug: string, id: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/api/${tenantSlug}/plans/proposals/${id}/export`, {
    responseType: "blob"
  });
  return data;
}

export type { DirectionContext, MultiProposalResult, ProposalConfig };
