import type { DirectionContext, MultiProposalInput, MultiProposalResult, ProposalRow, ProposalTotals } from "./types";
export declare function emptyTotals(): ProposalTotals;
export declare function combineTotals(items: ProposalTotals[]): ProposalTotals;
/** Bir yo'nalishdagi barcha KPI guruhlari uchun deterministik hisob. */
export declare function calculateMultiProposal(input: MultiProposalInput): MultiProposalResult;
/** KPI kesimidagi qatorlarni bitta xodim kaliti bo'yicha birlashtirish uchun yordamchi. */
export declare function rowsByEmployee(kpis: MultiProposalResult["kpis"]): Map<string, ProposalRow[]>;
export declare function totalsForRows(rows: ProposalRow[], sourceStatus?: "approved_only" | "official"): ProposalTotals;
export type { DirectionContext };
