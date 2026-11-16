"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMoney = assertMoney;
exports.addMoney = addMoney;
exports.multiplyBps = multiplyBps;
exports.roundMoney = roundMoney;
exports.parseMoneyInput = parseMoneyInput;
exports.formatMoney = formatMoney;
exports.moneyInput = moneyInput;
exports.percentChange = percentChange;
const MONEY_RE = /^-?\d+$/;
function assertMoney(value) {
    if (!MONEY_RE.test(value))
        throw new Error("INVALID_MONEY");
    const result = BigInt(value);
    if (result > 9223372036854775807n || result < -9223372036854775808n) {
        throw new Error("MONEY_OUT_OF_RANGE");
    }
    return result;
}
function addMoney(...values) {
    return values.reduce((sum, v) => sum + assertMoney(v), 0n).toString();
}
function multiplyBps(value, bps) {
    if (!Number.isSafeInteger(bps))
        throw new Error("INVALID_BPS");
    return (assertMoney(value) * BigInt(bps)).toString();
}
/** Non-negative, half-up, step minor birlikda. Pul uchun 100000 = 1000 so'm. */
function roundMoney(value, step) {
    const n = assertMoney(value);
    const s = assertMoney(step);
    if (s <= 0n)
        throw new Error("INVALID_ROUNDING_STEP");
    if (n <= 0n)
        return "0";
    return (((n + s / 2n) / s) * s).toString();
}
/** Foydalanuvchi kiritgan so'mni tiyinga aylantiradi; 2 xonadan ortiq aniqlikni qabul qilmaydi. */
function parseMoneyInput(input) {
    const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
        throw new Error("INVALID_MONEY_INPUT");
    const negative = normalized.startsWith("-");
    const [whole, fraction = ""] = normalized.replace("-", "").split(".");
    const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return (negative ? -result : result).toString();
}
function formatMoney(value, fractionDigits = 0) {
    if (value == null)
        return "—";
    const n = assertMoney(value);
    const negative = n < 0n;
    const abs = negative ? -n : n;
    const digits = Math.max(0, Math.min(2, Math.trunc(fractionDigits)));
    const unit = digits === 0 ? 100n : digits === 1 ? 10n : 1n;
    const rounded = ((abs + unit / 2n) / unit) * unit;
    const whole = rounded / 100n;
    const fraction = (rounded % 100n).toString().padStart(2, "0");
    const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const decimals = digits === 2 ? `,${fraction}` : digits === 1 ? `,${fraction[0]}` : "";
    return `${negative && rounded > 0n ? "−" : ""}${grouped}${decimals}`;
}
function moneyInput(value) {
    return (assertMoney(value) / 100n).toString();
}
function percentChange(base, value) {
    const b = assertMoney(base);
    if (b <= 0n)
        return null;
    return Number(((assertMoney(value) - b) * 10000n) / b) / 100;
}
