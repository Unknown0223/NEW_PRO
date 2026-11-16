import type { Period } from "./types";
export declare const MONTHS_UZ: string[];
export declare function periodKey(period: Period): string;
export declare function previousPeriod(period: Period): Period;
export declare function shiftPeriod(period: Period, delta: number): Period;
export declare function periodLabel(period: Period): string;
export declare function validPeriod(period: Period): boolean;
export declare function periodDistance(source: Period, target: Period): number;
