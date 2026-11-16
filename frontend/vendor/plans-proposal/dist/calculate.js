"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeRows = summarizeRows;
exports.validateContext = validateContext;
exports.calculateProposal = calculateProposal;
const money_1 = require("./money");
const config_1 = require("./config");
const period_1 = require("./period");
const issue = (code, severity, message) => ({ code, severity, message });
function percentileMedian(values) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2n;
}
function resolveBase(employee, formula, config, issues) {
    const { settings } = config;
    if (formula.basis === "previous_plan") {
        const plan = employee.previousPlan;
        if (!plan || plan.status === "missing") {
            issues.push(issue("NO_PREVIOUS_PLAN", "blocking", "Tanlangan oyda eski reja topilmadi. Qo‘lda reja kiriting."));
            return { raw: null, effective: null };
        }
        const accepted = settings.sourceStatus === "official" ? ["approved", "pending_approval"] : ["approved"];
        if (!accepted.includes(plan.status)) {
            issues.push(issue("PLAN_NOT_APPROVED", "blocking", "Eski reja hali tasdiqlanmagan. Maqom filtrini yoki manba oyini tekshiring."));
            return { raw: null, effective: null };
        }
        if (employee.fact?.status === "provisional")
            issues.push(issue("SOURCE_NOT_CLOSED", "warning", "Eski reja tanlandi, lekin manba oyi hali yopilmagan. Yakuniy reja oldidan qayta hisoblang."));
        if (employee.fact?.status === "final" &&
            plan.updatedAt &&
            employee.fact.updatedAt &&
            plan.updatedAt > employee.fact.updatedAt)
            issues.push(issue("SOURCE_UPDATED", "warning", "Eski reja fakt snapshotidan keyin yangilangan. Qayta hisoblash tavsiya etiladi."));
        if ((0, money_1.assertMoney)(plan.value) === 0n)
            issues.push(issue("ZERO_BASE", "warning", "Eski reja 0 so‘m. Foizli o‘sish 0 beradi."));
        return { raw: plan.value, effective: plan.value };
    }
    const fact = employee.fact;
    if (!fact) {
        issues.push(issue("NO_FACT", "blocking", "Manba oyida fakt ma’lumoti yo‘q. 0 deb taxmin qilinmadi."));
        return { raw: null, effective: null };
    }
    const rawNet = (0, money_1.assertMoney)(fact.net);
    const clamped = rawNet < 0n ? "0" : fact.net;
    if (rawNet < 0n)
        issues.push(issue("NEGATIVE_NET", "warning", "Qaytarishlar savdodan katta; hisob uchun sof fakt 0 ga tenglashtirildi."));
    if (rawNet === 0n)
        issues.push(issue("ZERO_BASE", "warning", "Sof fakt 0. Yangi xodim yoki ma’lumot kechikishini tekshiring."));
    let effective = clamped;
    if (fact.status === "provisional") {
        issues.push(issue("PARTIAL_PERIOD", "warning", "Manba oyi to‘liq emas: MTD qiymati to‘liq oylik fakt emas."));
        const p = settings.projection;
        if (p.enabled && p.elapsedWorkingDays > 0) {
            const projected = ((rawNet < 0n ? 0n : rawNet) * BigInt(p.totalWorkingDays) +
                BigInt(p.elapsedWorkingDays) / 2n) /
                BigInt(p.elapsedWorkingDays);
            effective = projected.toString();
            issues.push(issue("PROJECTED", "info", `Ish kunlari bo‘yicha prognoz: × ${p.totalWorkingDays} / ${p.elapsedWorkingDays}. Bu taxmin, fakt emas.`));
        }
    }
    return { raw: clamped, effective };
}
function applyFormula(base, formula) {
    const b = (0, money_1.assertMoney)(base);
    let unclamped;
    if (formula.mode === "amount") {
        const amount = (0, money_1.assertMoney)((0, money_1.parseMoneyInput)(String(formula.value)));
        unclamped = b + amount;
    }
    else {
        const bps = BigInt(Math.round(formula.value * 100));
        unclamped = (b * (10000n + bps) + 5000n) / 10000n;
    }
    const value = unclamped < 0n ? 0n : unclamped;
    return { value: value.toString(), adjustment: (value - b).toString() };
}
function calculateRow(employee, config) {
    const key = (0, config_1.employeeKey)(employee.employeeId, employee.workSlotId);
    const rule = (0, config_1.resolveRule)(config.rules, employee);
    const cellFormula = config.cellFormulas?.[key];
    const formula = cellFormula ?? rule?.formula ?? config.defaultFormula;
    const manual = config.overrides[key];
    const excluded = config.excluded.includes(key);
    const issues = [];
    if (!employee.active)
        issues.push(issue("INACTIVE", "blocking", "Xodim faol emas."));
    if (!employee.linked)
        issues.push(issue("NOT_LINKED", "blocking", "Xodim tanlangan KPI guruhiga biriktirilmagan."));
    const { raw, effective } = resolveBase(employee, formula, config, issues);
    const base = effective;
    let value = null;
    let adjustment = null;
    let origin = cellFormula ? "inline" : rule ? "rule" : "default";
    let ruleName = cellFormula ? "Jadval formula" : (rule?.name ?? "Umumiy qoida");
    let ruleId = cellFormula ? null : (rule?.id ?? null);
    if (excluded) {
        origin = "excluded";
        ruleName = "Hisobdan chiqarilgan";
        ruleId = null;
    }
    else if (manual) {
        origin = "manual";
        ruleName = "Qo‘lda kiritilgan";
        ruleId = null;
        value = (0, money_1.roundMoney)(manual.value, config.settings.roundingStep);
        adjustment = base == null ? null : ((0, money_1.assertMoney)(value) - (0, money_1.assertMoney)(base)).toString();
        issues.push(issue("MANUAL_REQUIRED", "info", `Qo‘lda: ${manual.reason}`));
    }
    else if (base != null && employee.active && employee.linked) {
        const calculated = applyFormula(base, formula);
        value = (0, money_1.roundMoney)(calculated.value, config.settings.roundingStep);
        adjustment = ((0, money_1.assertMoney)(value) - (0, money_1.assertMoney)(base)).toString();
        if (value !== calculated.value)
            issues.push(issue("ROUNDED", "info", `Yakuniy qiymat ${config.settings.roundingStep} tiyin qadamiga yaxlitlandi.`));
    }
    if (manual) {
        for (const i of issues) {
            if (["NO_FACT", "NO_PREVIOUS_PLAN", "PLAN_NOT_APPROVED"].includes(i.code)) {
                i.severity = "warning";
                i.message += " Qo‘lda kiritilgan qiymat manba o‘rnini bosadi.";
            }
        }
    }
    if (!excluded && value === "0")
        issues.push(issue("MANUAL_REQUIRED", "blocking", "Hisoblangan reja 0. Musbat reja kiriting yoki manbani tekshiring."));
    const growthPercent = value == null || base == null ? null : (0, money_1.percentChange)(base, value);
    if (!excluded && growthPercent != null && growthPercent > config.settings.growthWarningPercent) {
        issues.push(issue("BIG_INCREASE", "warning", `Asosga nisbatan +${growthPercent.toLocaleString("uz-UZ")}% — chegaradan yuqori.`));
    }
    const lookback = employee.history.slice(0, config.settings.outlierLookbackMonths);
    const median = percentileMedian(lookback.map((h) => (0, money_1.assertMoney)(h.net)));
    if (!excluded &&
        formula.basis === "fact" &&
        base != null &&
        median != null &&
        median > 0n &&
        (0, money_1.assertMoney)(base) > median * 2n) {
        issues.push(issue("OUTLIER", "warning", "Asos oxirgi oylar medianasidan 2 baravar katta. Bir martalik yirik savdoni tekshiring."));
    }
    const ready = !excluded &&
        value != null &&
        (0, money_1.assertMoney)(value) > 0n &&
        !issues.some((i) => i.severity === "blocking");
    return {
        key,
        employee,
        formula,
        ruleId,
        ruleName,
        origin,
        base,
        rawBase: raw,
        adjustment,
        value,
        growthPercent,
        issues,
        ready
    };
}
function summarizeRows(rows, sourceStatus) {
    const included = rows.filter((r) => r.origin !== "excluded");
    const ready = included.filter((r) => r.ready);
    const accepted = sourceStatus === "official" ? ["approved", "pending_approval"] : ["approved"];
    return {
        eligible: included.length,
        ready: ready.length,
        excluded: rows.length - included.length,
        warnings: included.filter((r) => r.issues.some((i) => i.severity === "warning")).length,
        blockers: included.filter((r) => r.issues.some((i) => i.severity === "blocking")).length,
        base: (0, money_1.addMoney)(...ready.map((r) => r.base).filter((v) => v != null)),
        proposed: (0, money_1.addMoney)(...ready.map((r) => r.value)),
        previousPlan: (0, money_1.addMoney)(...ready.map((r) => {
            const p = r.employee.previousPlan;
            return p && accepted.includes(p.status) ? p.value : "0";
        })),
        fact: (0, money_1.addMoney)(...ready.map((r) => {
            const net = r.employee.fact?.net;
            return net != null && (0, money_1.assertMoney)(net) > 0n ? net : "0";
        }))
    };
}
function validateContext(ctx) {
    if (!(0, period_1.validPeriod)(ctx.target) ||
        !(0, period_1.validPeriod)(ctx.source) ||
        (0, period_1.periodDistance)(ctx.source, ctx.target) < 0)
        throw new Error("Noto‘g‘ri davr: manba oyi maqsad oyidan keyin bo‘lishi mumkin emas");
    if (ctx.metric !== "cost" || ctx.tenantId <= 0 || ctx.directionId <= 0 || ctx.kpiGroupId <= 0)
        throw new Error("Noto‘g‘ri hisob konteksti");
}
/** Deterministik sof hisob. Hech qanday API, localStorage yoki DB yozuvi yo'q. */
function calculateProposal(input) {
    const error = (0, config_1.validateConfig)(input.config);
    if (error)
        throw new Error(error);
    validateContext(input.context);
    const rows = input.employees.map((e) => calculateRow(e, input.config));
    return { rows, totals: summarizeRows(rows, input.config.settings.sourceStatus) };
}
