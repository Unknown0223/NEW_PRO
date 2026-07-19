import type { PivotConfig, PivotField } from "../types/pivot.types.js";
/**
 * Caption for the synthetic `__row_label__` header.
 * Single row dimension → field catalog label (e.g. «Агент»), not generic «Группа».
 */
export declare function resolveRowAxisHeaderLabel(config: Pick<PivotConfig, "rows">, fields: PivotField[], fallback?: string): string;
//# sourceMappingURL=rowAxisHeader.d.ts.map