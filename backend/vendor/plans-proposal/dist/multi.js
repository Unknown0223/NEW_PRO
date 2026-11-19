"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyTotals = emptyTotals;
exports.combineTotals = combineTotals;
exports.calculateMultiProposal = calculateMultiProposal;
exports.rowsByEmployee = rowsByEmployee;
exports.totalsForRows = totalsForRows;
const calculate_1 = require("./calculate");
const config_1 = require("./config");
const money_1 = require("./money");
function emptyTotals() {
    return {
        eligible: 0,
        ready: 0,
        excluded: 0,
        warnings: 0,
        blockers: 0,
        base: "0",
        proposed: "0",
        previousPlan: "0",
        fact: "0"
    };
}
function combineTotals(items) {
    const out = emptyTotals();
    for (const t of items) {
        out.eligible += t.eligible;
        out.ready += t.ready;
        out.excluded += t.excluded;
        out.warnings += t.warnings;
        out.blockers += t.blockers;
        out.base = (0, money_1.addMoney)(out.base, t.base);
        out.proposed = (0, money_1.addMoney)(out.proposed, t.proposed);
        out.previousPlan = (0, money_1.addMoney)(out.previousPlan, t.previousPlan);
        out.fact = (0, money_1.addMoney)(out.fact, t.fact);
    }
    return out;
}
/** Bir yo'nalishdagi barcha KPI guruhlari uchun deterministik hisob. */
function calculateMultiProposal(input) {
    const ctx = input.context;
    if (!input.datasets.length)
        throw new Error("Kamida bitta KPI dataset kerak");
    const seen = new Set();
    for (const d of input.datasets) {
        if (!Number.isInteger(d.kpiGroupId) || d.kpiGroupId <= 0)
            throw new Error("Noto‘g‘ri KPI guruhi");
        if (seen.has(d.kpiGroupId))
            throw new Error("KPI guruhi takrorlangan");
        seen.add(d.kpiGroupId);
        const config = input.configs[String(d.kpiGroupId)];
        if (!config)
            throw new Error(`KPI ${d.kpiGroupId} uchun konfiguratsiya yo‘q`);
        const error = (0, config_1.validateConfig)(config);
        if (error)
            throw new Error(`KPI ${d.kpiGroupId}: ${error}`);
        (0, calculate_1.validateContext)({ ...ctx, kpiGroupId: d.kpiGroupId });
    }
    const kpis = input.datasets.map((d) => ({
        kpiGroupId: d.kpiGroupId,
        result: (0, calculate_1.calculateProposal)({
            context: { ...ctx, kpiGroupId: d.kpiGroupId },
            config: input.configs[String(d.kpiGroupId)],
            employees: d.employees
        })
    }));
    return { kpis, totals: combineTotals(kpis.map((k) => k.result.totals)) };
}
/** KPI kesimidagi qatorlarni bitta xodim kaliti bo'yicha birlashtirish uchun yordamchi. */
function rowsByEmployee(kpis) {
    const map = new Map();
    for (const k of kpis) {
        for (const row of k.result.rows) {
            const list = map.get(row.key) ?? [];
            list.push(row);
            map.set(row.key, list);
        }
    }
    return map;
}
function totalsForRows(rows, sourceStatus = "approved_only") {
    return (0, calculate_1.summarizeRows)(rows, sourceStatus);
}
