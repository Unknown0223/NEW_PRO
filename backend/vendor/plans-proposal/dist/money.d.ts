import type { Money } from "./types";
export declare function assertMoney(value: string): bigint;
export declare function addMoney(...values: Money[]): Money;
export declare function multiplyBps(value: Money, bps: number): Money;
/** Non-negative, half-up, step minor birlikda. Pul uchun 100000 = 1000 so'm. */
export declare function roundMoney(value: Money, step: Money): Money;
/** Foydalanuvchi kiritgan so'mni tiyinga aylantiradi; 2 xonadan ortiq aniqlikni qabul qilmaydi. */
export declare function parseMoneyInput(input: string): Money;
export declare function formatMoney(value: Money | null, fractionDigits?: number): string;
export declare function moneyInput(value: Money): string;
export declare function percentChange(base: Money, value: Money): number | null;
