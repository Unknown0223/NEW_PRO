import {
  calculateMultiProposal,
  type MultiProposalInput,
  type MultiProposalResult,
  type ProposalConfig
} from "@salec/plans-proposal";
import { buildProposalContext, toDirectionContext } from "./proposals.context";
import type { CalculateBody } from "./proposals.schema";
import type { Period } from "./proposals.period";

export type CalculateResult = {
  context: Awaited<ReturnType<typeof buildProposalContext>>;
  result: MultiProposalResult;
};

export async function calculateProposalLive(
  tenantId: number,
  body: CalculateBody
): Promise<CalculateResult> {
  const target: Period = body.target;
  const source: Period = body.source;
  const ctx = await buildProposalContext(tenantId, body.direction_id, target, source);
  const kpiIds =
    body.kpi_group_ids && body.kpi_group_ids.length > 0
      ? body.kpi_group_ids
      : ctx.kpi_groups.map((g) => g.id);

  const datasets = ctx.datasets.filter((d) => kpiIds.includes(d.kpiGroupId));
  if (!datasets.length) throw new Error("NO_KPI");

  const configs: Record<string, ProposalConfig> = {};
  for (const d of datasets) {
    const key = String(d.kpiGroupId);
    configs[key] = (body.configs[key] ??
      ctx.default_configs[key] ??
      body.configs[Object.keys(body.configs)[0]!]) as ProposalConfig;
    if (!configs[key]) throw new Error(`MISSING_CONFIG:${key}`);
  }

  const input: MultiProposalInput = {
    context: toDirectionContext(tenantId, body.direction_id, target, source),
    configs,
    datasets
  };
  const result = calculateMultiProposal(input);
  return { context: ctx, result };
}
