import type { Formula, ProposalConfig, ProposalRule, RuleScope } from "./types";
export declare const EMPTY_SCOPE: RuleScope;
export declare const DEFAULT_CONFIG: ProposalConfig;
export declare function cloneConfig(config: ProposalConfig): ProposalConfig;
export declare function employeeKey(employeeId: number, workSlotId: number | null): string;
export declare function validateFormula(formula: Formula): string | null;
export declare function validateConfig(config: ProposalConfig): string | null;
export declare function scopeMatches(scope: RuleScope, row: {
    employeeId: number;
    branchId: number;
    supervisorId: number | null;
    linked: boolean;
    active: boolean;
}): boolean;
export declare function resolveRule(rules: ProposalRule[], employee: Parameters<typeof scopeMatches>[1]): ProposalRule | null;
