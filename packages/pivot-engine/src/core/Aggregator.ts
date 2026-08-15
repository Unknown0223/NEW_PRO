import type { AggregationType } from "../types/pivot.types.js";

export class Aggregator {
  aggregate(values: number[], type: AggregationType): number | null {
    if (values.length === 0) return null;

    switch (type) {
      case "SUM":
        return values.reduce((a, b) => a + b, 0);

      case "COUNT":
        return values.length;

      case "COUNT_DISTINCT":
        return new Set(values).size;

      case "AVG":
        return values.reduce((a, b) => a + b, 0) / values.length;

      case "MIN":
        return Math.min(...values);

      case "MAX":
        return Math.max(...values);

      case "PRODUCT":
        return values.reduce((a, b) => a * b, 1);

      case "PERCENT_OF_TOTAL":
      case "PERCENT_OF_ROW":
      case "PERCENT_OF_COLUMN":
      case "RUNNING_TOTAL":
      case "INDEX":
      case "DIFFERENCE":
        // PivotEngine post-processor darajasida; bu yerda SUM qaytaramiz
        return values.reduce((a, b) => a + b, 0);

      case "CUSTOM":
        return values.reduce((a, b) => a + b, 0);

      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  /** O'zbekiston uchun maxsus: NDS hisoblash */
  calculateVAT(sum: number, rate = 0.12): number {
    return sum * rate;
  }

  /** Bonus hisoblash (SavdoDesk uchun) */
  calculateBonus(actualSales: number, targetSales: number, bonusPercent: number): number {
    if (actualSales >= targetSales) {
      return actualSales * (bonusPercent / 100);
    }
    return 0;
  }

  /** Retrobonus — chegarali bonus */
  calculateRetrobonus(
    totalVolume: number,
    tiers: Array<{ minVolume: number; percent: number }>
  ): number {
    const sorted = [...tiers].sort((a, b) => b.minVolume - a.minVolume);
    const applicable = sorted.find((t) => totalVolume >= t.minVolume);
    return applicable ? totalVolume * (applicable.percent / 100) : 0;
  }
}
