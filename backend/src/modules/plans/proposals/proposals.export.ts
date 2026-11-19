import { getProposalById } from "./proposals.draft";

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Proposal qatorlarini CSV (so‘m) qilib qaytaradi. */
export async function exportProposalCsv(tenantId: number, proposalId: number): Promise<string> {
  const p = await getProposalById(tenantId, proposalId);
  const header = [
    "proposal_id",
    "user_id",
    "kpi_group_id",
    "source_fact",
    "source_plan",
    "base",
    "proposed",
    "manual",
    "manual_reason",
    "excluded",
    "ready"
  ];
  const lines = [header.join(",")];
  for (const r of p.rows) {
    lines.push(
      [
        String(p.id),
        String(r.user_id),
        String(r.kpi_group_id),
        r.source_fact?.toString() ?? "",
        r.source_plan?.toString() ?? "",
        r.base_value?.toString() ?? "",
        r.proposed_value?.toString() ?? "",
        r.manual_value?.toString() ?? "",
        csvEscape(r.manual_reason ?? ""),
        r.excluded ? "1" : "0",
        r.ready ? "1" : "0"
      ].join(",")
    );
  }
  return lines.join("\n");
}
