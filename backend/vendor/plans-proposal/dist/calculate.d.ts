import type { ProposalConfig, ProposalContext, ProposalInput, ProposalResult, ProposalRow, ProposalTotals } from "./types";
export declare function summarizeRows(rows: ProposalRow[], sourceStatus: ProposalConfig["settings"]["sourceStatus"]): ProposalTotals;
export declare function validateContext(ctx: ProposalContext): void;
/** Deterministik sof hisob. Hech qanday API, localStorage yoki DB yozuvi yo'q. */
export declare function calculateProposal(input: ProposalInput): ProposalResult;
