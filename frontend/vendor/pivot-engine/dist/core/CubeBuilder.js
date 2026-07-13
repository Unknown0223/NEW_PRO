import { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR } from "../utils/groupBy.js";
export const ROOT_COL_KEY = "__root__";
/** Hash-based row×column×measure indeks — bir pass aggregation. */
export class CubeBuilder {
    constructor() {
        this.cube = new Map();
    }
    build(data, config) {
        this.cube.clear();
        this.ingestRows(data, config);
    }
    /** Mavjud cube ustiga yangi qatorlarni qo'shish (incremental update). */
    appendRows(data, config) {
        this.ingestRows(data, config);
    }
    ingestRows(data, config) {
        for (const row of data) {
            const colKey = this.makeColKey(row, config.columns);
            const rowKeys = this.makeRowKeys(row, config.rows);
            for (const rk of rowKeys) {
                for (const valueDef of config.values) {
                    const num = this.asNumber(row[valueDef.fieldId]);
                    if (num == null)
                        continue;
                    this.push(rk, colKey, valueDef.fieldId, num);
                }
            }
            for (const valueDef of config.values) {
                const num = this.asNumber(row[valueDef.fieldId]);
                if (num == null)
                    continue;
                this.push(ALL_GROUP_KEY, colKey, valueDef.fieldId, num);
            }
        }
    }
    getValues(rowKey, colKey, fieldId) {
        return this.cube.get(rowKey)?.get(colKey)?.get(fieldId) ?? [];
    }
    push(rowKey, colKey, fieldId, value) {
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
        }
        else {
            colBucket.set(fieldId, [value]);
        }
    }
    makeRowKeys(row, rowFields) {
        if (rowFields.length === 0)
            return [ALL_GROUP_KEY];
        const keys = [];
        for (let depth = 1; depth <= rowFields.length; depth++) {
            keys.push(this.makeKey(row, rowFields.slice(0, depth)));
        }
        return keys;
    }
    makeColKey(row, colFields) {
        if (colFields.length === 0)
            return ROOT_COL_KEY;
        return this.makeKey(row, colFields);
    }
    makeKey(row, fields) {
        return fields.map((f) => String(row[f] ?? "N/A")).join(GROUP_KEY_SEPARATOR);
    }
    asNumber(value) {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        return null;
    }
}
