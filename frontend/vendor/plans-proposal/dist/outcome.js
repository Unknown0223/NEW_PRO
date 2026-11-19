"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OUTCOME_TOLERANCE = exports.OUTCOME_METHOD_IDS = exports.OUTCOME_METHODS = void 0;
exports.buildOutcomeReport = buildOutcomeReport;
exports.outcomeVerdictLabel = outcomeVerdictLabel;
const calculate_1 = require("./calculate");
const config_1 = require("./config");
const money_1 = require("./money");
exports.OUTCOME_METHODS = [
    {
        id: "fact_10",
        name: "Sof fakt +10%",
        description: "Standart taklif: oldingi oy sof fakti +10%"
    },
    {
        id: "fact_5",
        name: "Sof fakt +5%",
        description: "Ehtiyotkor taklif: oldingi oy sof fakti +5%"
    },
    {
        id: "previous_plan",
        name: "Eski reja (o‘zgarishsiz)",
        description: "Oldingi oyning tasdiqlangan rejasi ko‘chiriladi"
    },
    {
        id: "history_median",
        name: "3 oy medianasi",
        description: "Oldingi 3 yakunlangan oy sof faktining medianasi"
    },
    {
        id: "draft",
        name: "Joriy umumiy draft",
        description: "Hozirgi draft qoidalari o‘sha davrga qayta qo‘llanadi"
    }
];
exports.OUTCOME_METHOD_IDS = exports.OUTCOME_METHODS.map((m) => m.id);
exports.DEFAULT_OUTCOME_TOLERANCE = 5;
function medianOf(values) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2n;
}
function keyOf(employee) {
    return (0, config_1.employeeKey)(employee.employeeId, employee.workSlotId);
}
function configForMethod(method, employees, draftConfig) {
    const config = (0, config_1.cloneConfig)(config_1.DEFAULT_CONFIG);
    if (method === "fact_5") {
        config.defaultFormula = { basis: "fact", mode: "percent", value: 5 };
    }
    else if (method === "previous_plan") {
        config.defaultFormula = { basis: "previous_plan", mode: "percent", value: 0 };
    }
    else if (method === "history_median") {
        config.excluded = [];
        for (const employee of employees) {
            const nets = employee.history
                .slice(0, 3)
                .map((h) => (0, money_1.assertMoney)(h.net))
                .filter((n) => n > 0n);
            const median = medianOf(nets);
            if (median == null)
                config.excluded.push(keyOf(employee));
            else
                config.overrides[keyOf(employee)] = {
                    value: median.toString(),
                    reason: "3 oy medianasi (backtest)"
                };
        }
    }
    else if (method === "draft") {
        return (0, config_1.cloneConfig)(draftConfig);
    }
    return config;
}
function predictionsFor(method, dataset, context, draftConfig) {
    const config = configForMethod(method, dataset.sourceEmployees, draftConfig);
    const result = (0, calculate_1.calculateProposal)({ context, config, employees: dataset.sourceEmployees });
    return new Map(result.rows.map((row) => [row.key, row.ready && row.value != null ? row.value : null]));
}
function deviationOf(predicted, actual) {
    if (predicted == null || actual == null)
        return null;
    const p = (0, money_1.assertMoney)(predicted);
    const a = (0, money_1.assertMoney)(actual);
    if (a <= 0n)
        return null;
    return Number(((p - a) * 10000n) / a) / 100;
}
function verdictOf(deviation, tolerance) {
    if (deviation == null)
        return "no_data";
    if (Math.abs(deviation) <= tolerance)
        return "justified";
    return deviation > 0 ? "over" : "under";
}
/**
 * Taklif usullarini yopilgan oyning haqiqiy fakti bilan solishtiradi.
 * Faqat sof hisob: API, localStorage va tasdiqlash oqimi yo‘q.
 */
function buildOutcomeReport(input) {
    const tolerance = input.tolerancePercent ?? exports.DEFAULT_OUTCOME_TOLERANCE;
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1000)
        throw new Error("Baholash chegarasi 0–1000 foiz oralig‘ida bo‘lishi kerak");
    if (!input.datasets.length) {
        return {
            target: input.context.target,
            source: input.context.source,
            tolerancePercent: tolerance,
            methods: exports.OUTCOME_METHODS,
            cells: [],
            summaries: exports.OUTCOME_METHODS.map((method) => ({
                id: method.id,
                name: method.name,
                description: method.description,
                cells: 0,
                compared: 0,
                justified: 0,
                over: 0,
                under: 0,
                noData: 0,
                accuracyPercent: null,
                meanAbsErrorPercent: null,
                predictedTotal: "0",
                actualTotal: "0",
                verdict: "no_data"
            })),
            comparedCells: 0
        };
    }
    const byMethod = new Map();
    for (const method of exports.OUTCOME_METHODS) {
        const perKpi = new Map();
        for (const dataset of input.datasets) {
            const context = {
                ...input.context,
                kpiGroupId: dataset.kpiGroupId
            };
            const draft = input.draftConfigs[String(dataset.kpiGroupId)] ?? config_1.DEFAULT_CONFIG;
            perKpi.set(dataset.kpiGroupId, predictionsFor(method.id, dataset, context, draft));
        }
        byMethod.set(method.id, perKpi);
    }
    const cells = [];
    for (const dataset of input.datasets) {
        for (const employee of dataset.sourceEmployees) {
            const key = keyOf(employee);
            const actual = dataset.actualByKey[key] ?? null;
            const predictions = {};
            const deviations = {};
            const verdicts = {};
            for (const method of exports.OUTCOME_METHODS) {
                const predicted = byMethod.get(method.id).get(dataset.kpiGroupId).get(key) ?? null;
                const deviation = deviationOf(predicted, actual);
                predictions[method.id] = predicted;
                deviations[method.id] = deviation;
                verdicts[method.id] = verdictOf(deviation, tolerance);
            }
            cells.push({
                key,
                employeeName: employee.name,
                kpiGroupId: dataset.kpiGroupId,
                actual,
                predictions,
                deviations,
                verdicts
            });
        }
    }
    const summaries = exports.OUTCOME_METHODS.map((method) => {
        let justified = 0;
        let over = 0;
        let under = 0;
        let noData = 0;
        let absSum = 0;
        let predictedItems = [];
        let actualItems = [];
        for (const cell of cells) {
            const verdict = cell.verdicts[method.id];
            if (verdict === "justified")
                justified++;
            else if (verdict === "over")
                over++;
            else if (verdict === "under")
                under++;
            else
                noData++;
            const deviation = cell.deviations[method.id];
            if (deviation != null) {
                absSum += Math.abs(deviation);
                predictedItems.push(cell.predictions[method.id]);
                actualItems.push(cell.actual);
            }
        }
        const compared = justified + over + under;
        const accuracy = compared ? Math.round((justified / compared) * 100) : null;
        const verdict = !compared
            ? "no_data"
            : justified / compared >= 0.6
                ? "justified"
                : over >= under
                    ? "over"
                    : "under";
        return {
            id: method.id,
            name: method.name,
            description: method.description,
            cells: cells.length,
            compared,
            justified,
            over,
            under,
            noData,
            accuracyPercent: accuracy,
            meanAbsErrorPercent: compared ? Math.round((absSum / compared) * 100) / 100 : null,
            predictedTotal: (0, money_1.addMoney)(...predictedItems),
            actualTotal: (0, money_1.addMoney)(...actualItems),
            verdict
        };
    });
    return {
        target: input.context.target,
        source: input.context.source,
        tolerancePercent: tolerance,
        methods: exports.OUTCOME_METHODS,
        cells,
        summaries,
        comparedCells: cells.filter((c) => c.verdicts.fact_10 !== "no_data").length
    };
}
function outcomeVerdictLabel(verdict) {
    return {
        justified: "O‘zini oqladi",
        over: "Oqlanmadi · yuqori",
        under: "Oqlanmadi · past",
        no_data: "Ma’lumot yo‘q"
    }[verdict];
}
