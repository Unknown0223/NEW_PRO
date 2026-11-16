import type { DirectionContext, EmployeeSource, Money, Period, ProposalConfig } from "./types";
/** Yopilgan oy fakti bilan solishtiriladigan taklif usullari. */
export type OutcomeMethodId = "fact_10" | "fact_5" | "previous_plan" | "history_median" | "draft";
export type OutcomeMethod = {
    id: OutcomeMethodId;
    name: string;
    description: string;
};
export declare const OUTCOME_METHODS: OutcomeMethod[];
export declare const OUTCOME_METHOD_IDS: OutcomeMethodId[];
export declare const DEFAULT_OUTCOME_TOLERANCE = 5;
export type OutcomeVerdict = "justified" | "over" | "under" | "no_data";
export type OutcomeDataset = {
    kpiGroupId: number;
    /** Taklif tuzilgan oy (manba) xodimlari: fakt, eski reja va tarix shu yerda. */
    sourceEmployees: EmployeeSource[];
    /** Baholanayotgan yopilgan oyning haqiqiy sof fakti, employeeKey bo‘yicha. */
    actualByKey: Record<string, Money | null>;
};
export type OutcomeInput = {
    context: DirectionContext & {
        target: Period;
        source: Period;
    };
    datasets: OutcomeDataset[];
    draftConfigs: Record<string, ProposalConfig>;
    tolerancePercent?: number;
};
export type OutcomeCell = {
    key: string;
    employeeName: string;
    kpiGroupId: number;
    actual: Money | null;
    predictions: Record<OutcomeMethodId, Money | null>;
    /** (taklif − fakt) / fakt, foizda; fakt bo‘lmasa null. */
    deviations: Record<OutcomeMethodId, number | null>;
    verdicts: Record<OutcomeMethodId, OutcomeVerdict>;
};
export type OutcomeSummary = {
    id: OutcomeMethodId;
    name: string;
    description: string;
    cells: number;
    compared: number;
    justified: number;
    over: number;
    under: number;
    noData: number;
    accuracyPercent: number | null;
    meanAbsErrorPercent: number | null;
    predictedTotal: Money;
    actualTotal: Money;
    verdict: OutcomeVerdict;
};
export type OutcomeReport = {
    target: Period;
    source: Period;
    tolerancePercent: number;
    methods: OutcomeMethod[];
    cells: OutcomeCell[];
    summaries: OutcomeSummary[];
    comparedCells: number;
};
/**
 * Taklif usullarini yopilgan oyning haqiqiy fakti bilan solishtiradi.
 * Faqat sof hisob: API, localStorage va tasdiqlash oqimi yo‘q.
 */
export declare function buildOutcomeReport(input: OutcomeInput): OutcomeReport;
export declare function outcomeVerdictLabel(verdict: OutcomeVerdict): string;
