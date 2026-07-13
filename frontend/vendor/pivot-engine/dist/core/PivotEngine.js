import { applyCalculatedMeasures, calculatedMeasuresToFields } from "../utils/calculatedMeasures.js";
import { getDrillThroughRecords } from "../utils/drillThrough.js";
import { formatValue } from "../utils/formatters.js";
import { lastGroupKeyPart, splitGroupKey, GROUP_KEY_SEPARATOR } from "../utils/groupBy.js";
import { Aggregator } from "./Aggregator.js";
import { CubeBuilder, ROOT_COL_KEY } from "./CubeBuilder.js";
import { CubeStore, hashAggregationConfig, hashFullConfig, hashPivotData, isAppendOnlyDataUpdate } from "./CubeStore.js";
import { DataTransformer } from "./DataTransformer.js";
import { FilterEngine } from "./FilterEngine.js";
import { applyDifferenceAggregations } from "./DifferenceProcessor.js";
import { applyIndexAggregations } from "./IndexProcessor.js";
import { applyPercentAggregations } from "./PercentProcessor.js";
import { applyRunningTotalAggregations } from "./RunningTotalProcessor.js";
import { SortEngine } from "./SortEngine.js";
import { getPivotStrings } from "../i18n/index.js";
export const DEFAULT_PIVOT_OPTIONS = {
    showSubtotals: true,
    showGrandTotal: true,
    showColumnTotals: false,
    compactMode: false,
    drillDown: true,
    maxRows: 10000
};
export const DEFAULT_PIVOT_CONFIG = {
    rows: [],
    columns: [],
    values: [],
    reportFilters: [],
    filters: [],
    options: { ...DEFAULT_PIVOT_OPTIONS }
};
export class PivotEngine {
    constructor() {
        this.aggregator = new Aggregator();
        this.filterEngine = new FilterEngine();
        this.transformer = new DataTransformer();
        this.sortEngine = new SortEngine();
        this.cubeStore = new CubeStore();
        this.cube = new CubeBuilder();
        this.resultCache = null;
        this.incrementalContext = null;
    }
    /** Drill-through: katakdagi manba qatorlar. */
    static getDrillThroughRecords(rawData, fields, config, cellContext) {
        const enrichedFields = [
            ...fields,
            ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])
        ];
        return getDrillThroughRecords(rawData, enrichedFields, config, cellContext);
    }
    getDrillThroughRecords(rawData, fields, config, cellContext) {
        return PivotEngine.getDrillThroughRecords(rawData, fields, config, cellContext);
    }
    /** CubeStore va natija keshini tozalash (testlar uchun). */
    clearCache() {
        this.cubeStore.clear();
        this.resultCache = null;
        this.incrementalContext = null;
    }
    get cubeCacheSize() {
        return this.cubeStore.size;
    }
    compute(rawData, fields, config) {
        const startTime = performance.now();
        const warnings = [];
        if (!config.values.length) {
            return {
                headers: [],
                rows: [],
                metadata: {
                    totalRows: rawData.length,
                    processedRows: 0,
                    executionTime: performance.now() - startTime,
                    warnings: [getPivotStrings().engine.noValueFields]
                }
            };
        }
        const reportScopedFilters = config.filters.filter((f) => config.reportFilters.includes(f.fieldId) ||
            config.rows.includes(f.fieldId) ||
            config.columns.includes(f.fieldId));
        const filteredData = this.filterEngine.apply(rawData, reportScopedFilters, fields);
        let workingData = applyCalculatedMeasures(filteredData, config.calculatedMeasures ?? [], fields);
        if (config.options.maxRows && workingData.length > config.options.maxRows) {
            warnings.push(`Ma'lumot ${workingData.length} qatordan ${config.options.maxRows} ga qisqartirildi`);
            workingData = workingData.slice(0, config.options.maxRows);
        }
        const enrichedFields = [
            ...fields,
            ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])
        ];
        const dataHash = hashPivotData(workingData);
        const configHash = hashAggregationConfig(config);
        const fullConfigHash = hashFullConfig(config);
        const resultKey = `${dataHash}|${fullConfigHash}`;
        if (this.resultCache?.key === resultKey) {
            return {
                ...this.resultCache.result,
                metadata: {
                    ...this.resultCache.result.metadata,
                    executionTime: performance.now() - startTime,
                    fromCache: true
                }
            };
        }
        const cached = this.cubeStore.get(dataHash, configHash);
        let usedIncremental = false;
        if (cached) {
            this.cube = cached.cube;
        }
        else if (this.incrementalContext?.configHash === configHash &&
            isAppendOnlyDataUpdate(this.incrementalContext.filteredData, workingData)) {
            const prevEntry = this.cubeStore.get(this.incrementalContext.dataHash, configHash);
            if (prevEntry) {
                const newRows = workingData.slice(this.incrementalContext.filteredData.length);
                this.cube = prevEntry.cube;
                this.cube.appendRows(newRows, config);
                usedIncremental = true;
                this.cubeStore.set({
                    cube: this.cube,
                    filteredData: workingData,
                    dataHash,
                    configHash
                });
            }
            else {
                this.cube = new CubeBuilder();
                this.cube.build(workingData, config);
                this.cubeStore.set({
                    cube: this.cube,
                    filteredData: workingData,
                    dataHash,
                    configHash
                });
            }
        }
        else {
            this.cube = new CubeBuilder();
            this.cube.build(workingData, config);
            this.cubeStore.set({
                cube: this.cube,
                filteredData: workingData,
                dataHash,
                configHash
            });
        }
        this.incrementalContext = { configHash, filteredData: workingData, dataHash };
        let colSpecs = this.buildColSpecs(workingData, config);
        colSpecs = this.sortEngine.sortColSpecs(colSpecs, config.options.sortBy, config);
        const headers = this.buildHeaders(colSpecs, config, enrichedFields);
        const rowGroups = config.rows.length > 0
            ? this.transformer.groupData(workingData, [config.rows[0]])
            : this.transformer.groupData(workingData, []);
        let rows = [];
        for (const [groupKey, groupData] of rowGroups) {
            if (groupKey === "__all__" && config.rows.length === 0) {
                rows.push(this.buildFlatRow(groupData, colSpecs, config, enrichedFields, getPivotStrings().engine.grandTotal, 0, groupKey));
                continue;
            }
            const rowLabel = lastGroupKeyPart(groupKey);
            const cells = this.buildCellsForData(groupData, colSpecs, config, enrichedFields, groupKey);
            const subtotal = config.options.showSubtotals && config.rows.length > 1
                ? this.buildSubtotalRow(groupData, colSpecs, config, enrichedFields, rowLabel, groupKey)
                : undefined;
            const children = config.options.drillDown && config.rows.length > 1
                ? this.buildChildRows(groupData, config, enrichedFields, colSpecs, 1, groupKey)
                : undefined;
            rows.push({
                key: groupKey,
                depth: 0,
                cells,
                subtotal,
                isExpanded: false,
                children
            });
        }
        rows = this.sortEngine.sortRows(rows, config.options.sortBy, config);
        const columnTotals = config.options.showColumnTotals && config.columns.length > 0
            ? this.buildColumnTotals(workingData, colSpecs, config, enrichedFields)
            : undefined;
        const grandTotal = config.options.showGrandTotal
            ? this.buildGrandTotal(workingData, colSpecs, config, enrichedFields)
            : undefined;
        const baseResult = {
            headers,
            rows,
            columnTotals,
            grandTotal,
            metadata: {
                totalRows: rawData.length,
                processedRows: filteredData.length,
                executionTime: performance.now() - startTime,
                warnings
            }
        };
        const withIndex = applyIndexAggregations(baseResult, config);
        const withDifference = applyDifferenceAggregations(withIndex, config);
        const withRunning = applyRunningTotalAggregations(withDifference, config);
        const result = applyPercentAggregations(withRunning, config);
        const finalResult = {
            ...result,
            metadata: {
                ...result.metadata,
                executionTime: performance.now() - startTime,
                incremental: usedIncremental || undefined
            }
        };
        this.resultCache = { key: resultKey, result: finalResult };
        return finalResult;
    }
    buildColSpecs(data, config) {
        if (config.columns.length === 0) {
            return config.values.map((v) => ({
                colKey: v.fieldId,
                colParts: [v.label ?? v.fieldId]
            }));
        }
        const colGroups = this.transformer.getColumnGroups(data, config.columns);
        const specs = [];
        for (const [colKey] of colGroups) {
            for (const valueDef of config.values) {
                const colParts = splitGroupKey(colKey);
                const valueLabel = valueDef.label ?? valueDef.fieldId;
                specs.push({
                    colKey: `${colKey}__${valueDef.fieldId}`,
                    colParts: [...colParts, valueLabel]
                });
            }
        }
        if (specs.length === 0 && config.values.length > 0) {
            for (const valueDef of config.values) {
                specs.push({
                    colKey: valueDef.fieldId,
                    colParts: [valueDef.label ?? valueDef.fieldId]
                });
            }
        }
        return specs;
    }
    buildHeaders(colSpecs, config, fields) {
        if (colSpecs.length === 0)
            return [];
        const rowLabelHeader = {
            key: "__row_label__",
            label: config.rows.length > 0 ? getPivotStrings().engine.group : "",
            colspan: 1,
            rowspan: config.columns.length > 0 ? config.columns.length + 1 : 1,
            depth: 0,
            isValue: false
        };
        if (config.columns.length === 0) {
            return [
                [
                    rowLabelHeader,
                    ...colSpecs.map((spec, i) => ({
                        key: spec.colKey,
                        label: spec.colParts[0] ?? spec.colKey,
                        colspan: 1,
                        rowspan: 1,
                        depth: 0,
                        isValue: true
                    }))
                ]
            ];
        }
        const levels = [];
        const colDepth = config.columns.length;
        const hasValueRow = config.values.length > 1 || config.columns.length > 0;
        const totalDepth = colDepth + (hasValueRow ? 1 : 0);
        for (let depth = 0; depth < colDepth; depth++) {
            const level = depth === 0 ? [rowLabelHeader] : [];
            let i = 0;
            while (i < colSpecs.length) {
                const part = colSpecs[i].colParts[depth] ?? "";
                let span = 1;
                while (i + span < colSpecs.length &&
                    colSpecs[i + span].colParts.slice(0, depth + 1).join("|") ===
                        colSpecs[i].colParts.slice(0, depth + 1).join("|")) {
                    span++;
                }
                level.push({
                    key: `col_${depth}_${i}`,
                    label: part,
                    colspan: span,
                    rowspan: 1,
                    depth,
                    isValue: false
                });
                i += span;
            }
            levels.push(level);
        }
        if (hasValueRow) {
            levels.push([
                ...(config.columns.length > 0
                    ? []
                    : [
                        {
                            key: "__row_label__2",
                            label: "",
                            colspan: 1,
                            rowspan: 1,
                            depth: colDepth,
                            isValue: false
                        }
                    ]),
                ...colSpecs.map((spec) => ({
                    key: spec.colKey,
                    label: spec.colParts[spec.colParts.length - 1] ?? spec.colKey,
                    colspan: 1,
                    rowspan: 1,
                    depth: colDepth,
                    isValue: true
                }))
            ]);
        }
        if (levels.length > 0 && levels[0][0]) {
            levels[0][0].rowspan = totalDepth;
        }
        return levels;
    }
    buildCellsForData(data, colSpecs, config, fields, rowGroupKey) {
        const labelCell = {
            value: null,
            rawValue: null,
            formatted: "",
            columnKey: "__row_label__",
            isEmpty: true
        };
        const valueCells = colSpecs.map((spec) => this.computeCell(data, spec, config, fields, rowGroupKey));
        return config.rows.length > 0 ? [labelCell, ...valueCells] : valueCells;
    }
    computeCell(data, spec, config, fields, rowGroupKey) {
        let valueDef;
        let colCubeKey = ROOT_COL_KEY;
        if (config.columns.length > 0) {
            colCubeKey = spec.colKey.split("__")[0] ?? ROOT_COL_KEY;
            const fieldId = spec.colKey.split("__").slice(1).join("__");
            valueDef = config.values.find((v) => v.fieldId === fieldId) ?? config.values[0];
        }
        else {
            valueDef = config.values.find((v) => v.fieldId === spec.colKey) ?? config.values[0];
        }
        if (!valueDef) {
            return {
                value: null,
                rawValue: null,
                formatted: "—",
                columnKey: spec.colKey,
                isEmpty: true
            };
        }
        const cubeValues = this.cube.getValues(rowGroupKey, colCubeKey, valueDef.fieldId);
        const rawValues = cubeValues.length > 0
            ? cubeValues
            : this.extractNumericValuesFromSubset(data, spec, config, valueDef.fieldId);
        const field = fields.find((f) => f.id === valueDef.fieldId);
        let rawValue;
        if (valueDef.aggregation === "CUSTOM" && valueDef.customAggregator) {
            rawValue = valueDef.customAggregator(rawValues);
        }
        else {
            rawValue = this.aggregator.aggregate(rawValues, valueDef.aggregation);
        }
        const formatted = formatValue(rawValue, valueDef.format ?? field?.format);
        return {
            value: rawValue,
            rawValue,
            formatted,
            columnKey: spec.colKey,
            isEmpty: rawValues.length === 0,
            drillContext: {
                rowGroupKey,
                colCubeKey,
                valueFieldId: valueDef.fieldId
            }
        };
    }
    /** Cube miss bo'lsa fallback (masalan, maxRows kesilgan holat). */
    extractNumericValuesFromSubset(data, spec, config, fieldId) {
        let subset = data;
        if (config.columns.length > 0) {
            const colKey = spec.colKey.split("__")[0];
            subset = data.filter((row) => this.rowMatchesColKey(row, config.columns, colKey));
        }
        return this.extractNumericValues(subset, fieldId);
    }
    rowMatchesColKey(row, colFields, colKey) {
        const parts = splitGroupKey(colKey);
        return colFields.every((field, i) => String(row[field] ?? "N/A") === parts[i]);
    }
    extractNumericValues(data, fieldId) {
        return data
            .map((r) => r[fieldId])
            .filter((v) => typeof v === "number" && Number.isFinite(v));
    }
    buildFlatRow(data, colSpecs, config, fields, label, depth, rowGroupKey) {
        const cells = this.buildCellsForData(data, colSpecs, config, fields, rowGroupKey);
        if (cells[0]) {
            cells[0] = {
                ...cells[0],
                value: label,
                formatted: label,
                isEmpty: false
            };
        }
        return { key: label, depth, cells };
    }
    buildChildRows(data, config, fields, colSpecs, depth, parentRowGroupKey) {
        if (depth >= config.rows.length)
            return [];
        const childField = config.rows[depth];
        const childGroups = this.transformer.groupData(data, [childField]);
        const result = [];
        for (const [groupKey, groupData] of childGroups) {
            const rowGroupKey = `${parentRowGroupKey}${GROUP_KEY_SEPARATOR}${groupKey}`;
            const rowLabel = lastGroupKeyPart(groupKey);
            const cells = this.buildCellsForData(groupData, colSpecs, config, fields, rowGroupKey);
            if (cells[0]) {
                cells[0] = {
                    ...cells[0],
                    value: rowLabel,
                    formatted: rowLabel,
                    isEmpty: false
                };
            }
            const children = depth + 1 < config.rows.length
                ? this.buildChildRows(groupData, config, fields, colSpecs, depth + 1, rowGroupKey)
                : undefined;
            result.push({
                key: `${parentRowGroupKey} > ${groupKey}`,
                depth,
                cells,
                parentKey: parentRowGroupKey,
                children,
                isExpanded: false
            });
        }
        return this.sortEngine.sortRows(result, config.options.sortBy, config);
    }
    buildSubtotalRow(data, colSpecs, config, fields, parentLabel, rowGroupKey) {
        const cells = this.buildCellsForData(data, colSpecs, config, fields, rowGroupKey);
        if (cells[0]) {
            cells[0] = {
                ...cells[0],
                value: getPivotStrings().engine.subtotalInline(parentLabel),
                formatted: getPivotStrings().engine.subtotalInline(parentLabel),
                isEmpty: false
            };
        }
        return { label: getPivotStrings().engine.subtotal, cells };
    }
    buildColumnTotals(data, colSpecs, config, fields) {
        const cells = this.buildCellsForData(data, colSpecs, config, fields, "__all__");
        if (cells[0]) {
            cells[0] = {
                ...cells[0],
                value: getPivotStrings().engine.columnTotal,
                formatted: getPivotStrings().engine.columnTotal,
                isEmpty: false,
                drillContext: undefined
            };
        }
        for (const cell of cells.slice(1)) {
            cell.drillContext = cell.drillContext
                ? { ...cell.drillContext, rowGroupKey: "__all__" }
                : undefined;
        }
        return { label: getPivotStrings().engine.columnTotal, cells };
    }
    buildGrandTotal(data, colSpecs, config, fields) {
        const cells = this.buildCellsForData(data, colSpecs, config, fields, "__all__");
        if (cells[0]) {
            cells[0] = {
                ...cells[0],
                value: getPivotStrings().engine.grandTotal,
                formatted: getPivotStrings().engine.grandTotal,
                isEmpty: false
            };
        }
        return { label: getPivotStrings().engine.grandTotal, cells };
    }
}
