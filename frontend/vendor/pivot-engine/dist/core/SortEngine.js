import { lastGroupKeyPart } from "../utils/groupBy.js";
export class SortEngine {
    /** Qatorlarni `options.sortBy` bo'yicha tartiblaydi (rekursiv). */
    sortRows(rows, sortBy, config) {
        if (!sortBy || rows.length <= 1) {
            return rows.map((row) => this.sortRowChildren(row, sortBy, config));
        }
        const sorted = [...rows].sort((a, b) => this.compareRows(a, b, sortBy, config));
        return sorted.map((row) => this.sortRowChildren(row, sortBy, config));
    }
    /** Ustun spetsifikatsiyalarini tartiblaydi. */
    sortColSpecs(colSpecs, sortBy, config) {
        if (!sortBy || colSpecs.length <= 1)
            return colSpecs;
        const colIndex = config.columns.indexOf(sortBy.fieldId);
        if (colIndex >= 0) {
            return [...colSpecs].sort((a, b) => this.compareScalars(a.colParts[colIndex] ?? "", b.colParts[colIndex] ?? "", sortBy.direction));
        }
        const valueIndex = config.values.findIndex((v) => v.fieldId === sortBy.fieldId);
        if (valueIndex >= 0) {
            return [...colSpecs].sort((a, b) => {
                const aLabel = a.colParts[a.colParts.length - 1] ?? "";
                const bLabel = b.colParts[b.colParts.length - 1] ?? "";
                return this.compareScalars(aLabel, bLabel, sortBy.direction);
            });
        }
        return colSpecs;
    }
    sortRowChildren(row, sortBy, config) {
        if (!row.children?.length)
            return row;
        return {
            ...row,
            children: this.sortRows(row.children, sortBy, config)
        };
    }
    compareRows(a, b, sortBy, config) {
        if (config.rows.includes(sortBy.fieldId)) {
            const aLabel = a.cells[0]?.formatted || lastGroupKeyPart(a.key);
            const bLabel = b.cells[0]?.formatted || lastGroupKeyPart(b.key);
            return this.compareScalars(aLabel, bLabel, sortBy.direction);
        }
        const measureCell = (row) => this.findMeasureCell(row, sortBy.fieldId, config);
        const aVal = measureCell(a);
        const bVal = measureCell(b);
        if (aVal == null && bVal == null)
            return 0;
        if (aVal == null)
            return 1;
        if (bVal == null)
            return -1;
        return this.compareScalars(aVal, bVal, sortBy.direction);
    }
    findMeasureCell(row, fieldId, config) {
        const cell = row.cells.find((c) => c.columnKey === fieldId ||
            c.columnKey.endsWith(`__${fieldId}`) ||
            c.columnKey.includes(`__${fieldId}`));
        if (cell?.rawValue != null)
            return cell.rawValue;
        if (config.columns.length === 0) {
            const idx = config.values.findIndex((v) => v.fieldId === fieldId);
            const valueCell = row.cells[config.rows.length > 0 ? idx + 1 : idx];
            return valueCell?.rawValue ?? null;
        }
        return cell?.rawValue ?? null;
    }
    compareScalars(a, b, direction) {
        const aNum = typeof a === "number" ? a : Number(a);
        const bNum = typeof b === "number" ? b : Number(b);
        const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);
        let cmp;
        if (bothNumeric) {
            cmp = aNum - bNum;
        }
        else {
            cmp = String(a).localeCompare(String(b), "uz-UZ", { numeric: true, sensitivity: "base" });
        }
        return direction === "desc" ? -cmp : cmp;
    }
}
