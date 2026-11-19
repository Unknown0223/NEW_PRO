import type { Money } from "./types";

const MONEY_RE = /^-?\d+$/;

export function assertMoney(value: string): bigint {
  if (!MONEY_RE.test(value)) throw new Error("INVALID_MONEY");
  const result = BigInt(value);
  if (result > 9_223_372_036_854_775_807n || result < -9_223_372_036_854_775_808n) {
    throw new Error("MONEY_OUT_OF_RANGE");
  }
  return result;
}

export function addMoney(...values: Money[]): Money {
  return values.reduce((sum, v) => sum + assertMoney(v), 0n).toString();
}

export function multiplyBps(value: Money, bps: number): Money {
  if (!Number.isSafeInteger(bps)) throw new Error("INVALID_BPS");
  return (assertMoney(value) * BigInt(bps)).toString();
}

/** Non-negative, half-up, step minor birlikda. Pul uchun 100000 = 1000 so'm. */
export function roundMoney(value: Money, step: Money): Money {
  const n = assertMoney(value);
  const s = assertMoney(step);
  if (s <= 0n) throw new Error("INVALID_ROUNDING_STEP");
  if (n <= 0n) return "0";
  return (((n + s / 2n) / s) * s).toString();
}

/** Foydalanuvchi kiritgan so'mni tiyinga aylantiradi; 2 xonadan ortiq aniqlikni qabul qilmaydi. */
export function parseMoneyInput(input: string): Money {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("INVALID_MONEY_INPUT");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return (negative ? -result : result).toString();
}

export function formatMoney(value: Money | null, fractionDigits = 0): string {
  if (value == null) return "—";
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

export function moneyInput(value: Money): string {
  return (assertMoney(value) / 100n).toString();
}

export function percentChange(base: Money, value: Money): number | null {
  const b = assertMoney(base);
  if (b <= 0n) return null;
  return Number(((assertMoney(value) - b) * 10000n) / b) / 100;
}
