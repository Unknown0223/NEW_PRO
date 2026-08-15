import type { AggregationType } from "../types/pivot.types.js";
export type PivotLocale = "ru" | "uz";
export type CalculatedMeasurePreset = {
    id: string;
    label: string;
    formula: string;
    description: string;
    tierPresetId?: string;
};
export type PivotTableMetaExtras = {
    virtual?: string;
    fromCache?: boolean;
    incremental?: boolean;
};
export type PivotStrings = {
    locale: PivotLocale;
    zones: {
        fields: string;
        reportFilters: string;
        columns: string;
        rows: string;
        values: string;
        reportFiltersHint: string;
        columnsHint: string;
        rowsHint: string;
        valuesHint: string;
    };
    toolbar: {
        table: string;
        chart: string;
        excel: string;
        pdf: string;
        html: string;
        fullscreen: string;
        exitFullscreen: string;
        expandAll: string;
        collapseAll: string;
        reset: string;
        resetConfig: string;
        columnTotals: string;
        clearFilters: (count: number) => string;
        chartPng: string;
    };
    chart: {
        bar: string;
        line: string;
        noData: string;
        truncatedCategories: (shown: number, total: number) => string;
        largeDatasetWarning: (rows: number) => string;
        exporting: string;
    };
    export: {
        largeSourceWarning: (rows: number) => string;
        largeExportWarning: (rows: number) => string;
        confirmLargeExport: (rows: number) => string;
        preparing: string;
        writing: string;
        done: string;
        progress: (processed: number, total: number) => string;
        exportingExcel: string;
        exportingPdf: string;
        exportingHtml: string;
    };
    table: {
        group: string;
        rowsMeta: (processed: string, ms: string, extras?: PivotTableMetaExtras) => string;
        drillThroughHint: string;
        expand: string;
        collapse: string;
    };
    drillThrough: {
        title: string;
        sheetName: string;
        noRows: string;
        rowCount: (count: string) => string;
        showing: (shown: number, total: number) => string;
        close: string;
    };
    filters: {
        selected: string;
        exclude: string;
        search: string;
        cancel: string;
        apply: string;
        topN: string;
        topHighest: string;
        topLowest: string;
        nValue: string;
        metricOptional: string;
        rowCount: string;
        from: string;
        to: string;
        min: string;
        max: string;
        noOptions: string;
        configureFilter: string;
        remove: string;
        reorder: string;
        filter: string;
        selectedCount: (count: number) => string;
    };
    aggregations: Record<AggregationType, string>;
    engine: {
        group: string;
        grandTotal: string;
        subtotal: string;
        subtotalInline: (name: string) => string;
        columnTotal: string;
        noValueFields: string;
    };
    demo: {
        title: string;
        subtitle: (rows: string, worker?: boolean, computing?: boolean) => string;
        workerHint: string;
        computing: (worker?: boolean) => string;
        addMetric: string;
    };
    reportBuilder: {
        title: string;
        subtitle: string;
        fullDemo: string;
        datasetFilters: string;
        loadData: string;
        savedReports: string;
        save: string;
        computing: string;
        workerActive: string;
        loadingMetadata: string;
        dragMetricHint: string;
        wdrImport: string;
        wdrSliceJson: string;
        savedReportIncompatible: string;
        wdrSliceNotFound: string;
        jsonReadError: string;
        savePrompt: string;
        savedReportWdrSuffix: string;
        sliceTemplatesLabel: string;
    };
    calculatedMeasurePresets: CalculatedMeasurePreset[];
    sliceTemplates: Array<{
        id: string;
        label: string;
        description: string;
    }>;
};
//# sourceMappingURL=types.d.ts.map