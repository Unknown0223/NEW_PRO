"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTHS_UZ = void 0;
exports.periodKey = periodKey;
exports.previousPeriod = previousPeriod;
exports.shiftPeriod = shiftPeriod;
exports.periodLabel = periodLabel;
exports.validPeriod = validPeriod;
exports.periodDistance = periodDistance;
exports.MONTHS_UZ = [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentabr",
    "Oktabr",
    "Noyabr",
    "Dekabr"
];
function periodKey(period) {
    return `${period.year}-${String(period.month).padStart(2, "0")}`;
}
function previousPeriod(period) {
    return period.month === 1
        ? { year: period.year - 1, month: 12 }
        : { year: period.year, month: period.month - 1 };
}
function shiftPeriod(period, delta) {
    const index = period.year * 12 + period.month - 1 + delta;
    return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}
function periodLabel(period) {
    return `${exports.MONTHS_UZ[period.month - 1]} ${period.year}`;
}
function validPeriod(period) {
    return (Number.isInteger(period.year) &&
        period.year >= 2000 &&
        period.year <= 2100 &&
        Number.isInteger(period.month) &&
        period.month >= 1 &&
        period.month <= 12);
}
function periodDistance(source, target) {
    return (target.year - source.year) * 12 + target.month - source.month;
}
