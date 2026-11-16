/** Pul minor birlikda (UZS tiyin), decimal string. JS float bilan hisoblanmaydi. */
export type Money = string;
export type Basis = "fact" | "previous_plan";
export type AdjustmentMode = "percent" | "amount";
export type Metric = "cost";
export type SourceStatus = "final" | "provisional";
/** Qisman oy faktini ish kunlari bo'yicha uzaytirish — faqat aniq opt-in. */
export type Projection = {
    enabled: boolean;
    elapsedWorkingDays: number;
    totalWorkingDays: number;
};
export type Formula = {
    basis: Basis;
    mode: AdjustmentMode;
    /** percent: 10 = +10%, -5 = kamaytirish; amount: so'm, masalan 5000000. */
    value: number;
};
export type RuleScope = {
    kind: "all" | "employees";
    employeeIds: number[];
    branchIds: number[];
    supervisorIds: number[];
};
/** Ro'yxat tartibi = ustuvorlik; oxirgi mos qoida g'olib. Manual override undan yuqori. */
export type ProposalRule = {
    id: string;
    name: string;
    enabled: boolean;
    scope: RuleScope;
    formula: Formula;
};
export type ManualTarget = {
    value: Money;
    reason: string;
};
export type ProposalSettings = {
    sourceStatus: "approved_only" | "official";
    projection: Projection;
    roundingStep: Money;
    /** Shu foizdan katta sakrashlar ogohlantiradi, natijani o'zgartirmaydi. */
    growthWarningPercent: number;
    outlierLookbackMonths: number;
};
export type ProposalConfig = {
    defaultFormula: Formula;
    rules: ProposalRule[];
    /** Jadval katakchasida kiritilgan aniq formula: employeeKey -> Formula. Manualdan past. */
    cellFormulas?: Record<string, Formula>;
    overrides: Record<string, ManualTarget>;
    excluded: string[];
    settings: ProposalSettings;
};
export type Period = {
    year: number;
    month: number;
};
export type ProposalContext = {
    tenantId: number;
    directionId: number;
    kpiGroupId: number;
    target: Period;
    source: Period;
    metric: Metric;
};
/** Bir yo'nalish ichida bir nechta KPI guruhi uchun umumiy kontekst. */
export type DirectionContext = Omit<ProposalContext, "kpiGroupId">;
export type SourceMetric = {
    status: SourceStatus;
    gross: Money;
    returns: Money;
    net: Money;
    /** Haqiqiy kuzatilgan kunlar; ishdagi kunlar emas. */
    observedDays: number;
    daysInMonth: number;
    updatedAt: string;
};
export type SourcePlan = {
    status: "approved" | "pending_approval" | "draft" | "missing";
    value: Money;
    updatedAt: string | null;
};
export type EmployeeSource = {
    employeeId: number;
    workSlotId: number | null;
    name: string;
    code: string | null;
    role: string;
    branchId: number;
    branch: string;
    supervisorId: number | null;
    supervisor: string;
    linked: boolean;
    active: boolean;
    fact: SourceMetric | null;
    previousPlan: SourcePlan | null;
    /** Yangidan eskiga tartiblangan, yakunlangan oylik sof fakt tarixi. */
    history: Array<{
        period: string;
        net: Money;
    }>;
};
export type ProposalInput = {
    context: ProposalContext;
    config: ProposalConfig;
    employees: EmployeeSource[];
};
export type IssueCode = "NOT_LINKED" | "INACTIVE" | "NO_FACT" | "NO_PREVIOUS_PLAN" | "PLAN_NOT_APPROVED" | "SOURCE_NOT_CLOSED" | "SOURCE_UPDATED" | "ZERO_BASE" | "NEGATIVE_NET" | "PARTIAL_PERIOD" | "PROJECTED" | "BIG_INCREASE" | "OUTLIER" | "MANUAL_REQUIRED" | "ROUNDED";
export type ProposalIssue = {
    code: IssueCode;
    severity: "info" | "warning" | "blocking";
    message: string;
};
export type ProposalRow = {
    key: string;
    employee: EmployeeSource;
    formula: Formula;
    ruleId: string | null;
    ruleName: string;
    origin: "default" | "rule" | "inline" | "manual" | "excluded";
    base: Money | null;
    rawBase: Money | null;
    adjustment: Money | null;
    value: Money | null;
    growthPercent: number | null;
    issues: ProposalIssue[];
    ready: boolean;
};
export type ProposalTotals = {
    eligible: number;
    ready: number;
    excluded: number;
    warnings: number;
    blockers: number;
    base: Money;
    proposed: Money;
    previousPlan: Money;
    fact: Money;
};
export type ProposalResult = {
    rows: ProposalRow[];
    totals: ProposalTotals;
};
/** Ko'p KPI: bitta yo'nalish, bir nechta KPI dataset va har biriga alohida konfiguratsiya. */
export type KpiDataset = {
    kpiGroupId: number;
    employees: EmployeeSource[];
};
export type MultiProposalInput = {
    context: DirectionContext;
    datasets: KpiDataset[];
    /** Kalit — kpiGroupId string ko'rinishida. */
    configs: Record<string, ProposalConfig>;
};
export type KpiProposalResult = {
    kpiGroupId: number;
    result: ProposalResult;
};
export type MultiProposalResult = {
    kpis: KpiProposalResult[];
    totals: ProposalTotals;
};
