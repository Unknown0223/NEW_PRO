import type { PivotField } from "@salec/pivot-engine";
/** Preferred drill-through columns for SALEC sales lines. */
export declare const SALEC_DRILL_PREFERRED: readonly ["client_name", "agent_name", "category_name", "product_name", "product_sku", "brand_name", "is_bonus", "bonus_qty", "amount", "qty", "volume", "order_number", "order_status"];
export declare const SALEC_DRILL_EXCLUDED: Set<string>;
export declare const GENERIC_DRILL_PREFERRED: readonly ["Country", "Category", "Product", "Price", "Discount", "Quantity"];
export declare function resolveDrillThroughColumns(records: Record<string, unknown>[], fields: PivotField[], opts?: {
    preferred?: readonly string[];
    excluded?: Set<string>;
    valueFieldId?: string;
    maxColumns?: number;
}): string[];
//# sourceMappingURL=drillColumns.d.ts.map