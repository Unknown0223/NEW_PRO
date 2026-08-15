import type { AggregationType } from "../types/pivot.types.js";
export declare class Aggregator {
    aggregate(values: number[], type: AggregationType): number | null;
    /** O'zbekiston uchun maxsus: NDS hisoblash */
    calculateVAT(sum: number, rate?: number): number;
    /** Bonus hisoblash (SavdoDesk uchun) */
    calculateBonus(actualSales: number, targetSales: number, bonusPercent: number): number;
    /** Retrobonus — chegarali bonus */
    calculateRetrobonus(totalVolume: number, tiers: Array<{
        minVolume: number;
        percent: number;
    }>): number;
}
//# sourceMappingURL=Aggregator.d.ts.map