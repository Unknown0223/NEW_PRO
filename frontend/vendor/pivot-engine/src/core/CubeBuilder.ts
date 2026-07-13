import type { PivotConfig } from "../types/pivot.types.js";
import { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR } from "../utils/groupBy.js";

export const ROOT_COL_KEY = "__root__";

/** Hash-based row×column×measure indeks — bir pass aggregation. */
export class CubeBuilder {
  private cube = new Map<string, Map<string, Map<string, number[]>>>();

  build(data: Record<string, unknown>[], config: PivotConfig): void {
    this.cube.clear();
    this.ingestRows(data, config);
  }

  /** Mavjud cube ustiga yangi qatorlarni qo'shish (incremental update). */
  appendRows(data: Record<string, unknown>[], config: PivotConfig): void {
    this.ingestRows(data, config);
  }

  private ingestRows(data: Record<string, unknown>[], config: PivotConfig): void {
    for (const row of data) {
      const colKey = this.makeColKey(row, config.columns);
      const rowKeys = this.makeRowKeys(row, config.rows);

      for (const rk of rowKeys) {
        for (const valueDef of config.values) {
          const num = this.asNumber(row[valueDef.fieldId]);
          if (num == null) continue;
          this.push(rk, colKey, valueDef.fieldId, num);
        }
      }

      for (const valueDef of config.values) {
        const num = this.asNumber(row[valueDef.fieldId]);
        if (num == null) continue;
        this.push(ALL_GROUP_KEY, colKey, valueDef.fieldId, num);
      }
    }
  }

  getValues(rowKey: string, colKey: string, fieldId: string): number[] {
    return this.cube.get(rowKey)?.get(colKey)?.get(fieldId) ?? [];
  }

  private push(rowKey: string, colKey: string, fieldId: string, value: number): void {
    let rowBucket = this.cube.get(rowKey);
    if (!rowBucket) {
      rowBucket = new Map();
      this.cube.set(rowKey, rowBucket);
    }

    let colBucket = rowBucket.get(colKey);
    if (!colBucket) {
      colBucket = new Map();
      rowBucket.set(colKey, colBucket);
    }

    const arr = colBucket.get(fieldId);
    if (arr) {
      arr.push(value);
    } else {
      colBucket.set(fieldId, [value]);
    }
  }

  private makeRowKeys(row: Record<string, unknown>, rowFields: string[]): string[] {
    if (rowFields.length === 0) return [ALL_GROUP_KEY];

    const keys: string[] = [];
    for (let depth = 1; depth <= rowFields.length; depth++) {
      keys.push(this.makeKey(row, rowFields.slice(0, depth)));
    }
    return keys;
  }

  private makeColKey(row: Record<string, unknown>, colFields: string[]): string {
    if (colFields.length === 0) return ROOT_COL_KEY;
    return this.makeKey(row, colFields);
  }

  private makeKey(row: Record<string, unknown>, fields: string[]): string {
    return fields.map((f) => String(row[f] ?? "N/A")).join(GROUP_KEY_SEPARATOR);
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  }
}
