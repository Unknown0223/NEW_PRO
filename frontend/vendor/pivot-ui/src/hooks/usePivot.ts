"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PivotEngine,
  DEFAULT_PIVOT_CONFIG,
  DEFAULT_WORKER_THRESHOLD,
  createPivotWorkerClient,
  CALCULATED_MEASURE_PRESETS,
  calculatedMeasuresToFields,
  collectExpandableRowKeys,
  createDefaultPivotConfig,
  isEmptyPivotConfig,
  type AggregationType,
  type CalculatedMeasure,
  type PivotCell,
  type PivotConfig,
  type PivotData,
  type PivotField,
  type PivotFilter,
  type PivotWorkerClient
} from "@salec/pivot-engine";
import { createDemoPivotWorker } from "../lib/pivotWorker.js";

type BuilderZone = "rows" | "columns" | "values" | "reportFilters";

type UsePivotOptions = {
  initialConfig?: Partial<PivotConfig>;
  workerThreshold?: number;
  useWorker?: boolean;
};

export function usePivot(
  rawData: Record<string, unknown>[],
  fields: PivotField[],
  options: UsePivotOptions = {}
) {
  const engineRef = useRef(new PivotEngine());
  const workerRef = useRef<PivotWorkerClient | null>(null);
  const [config, setConfig] = useState<PivotConfig>({
    ...DEFAULT_PIVOT_CONFIG,
    ...options.initialConfig
  });
  const [pivotData, setPivotData] = useState<PivotData | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRecords, setDrillRecords] = useState<Record<string, unknown>[]>([]);
  const [drillCell, setDrillCell] = useState<PivotCell | null>(null);

  const useWorker = options.useWorker !== false;

  useEffect(() => {
    if (!useWorker || typeof Worker === "undefined") return;
    workerRef.current = createPivotWorkerClient({
      threshold: options.workerThreshold ?? DEFAULT_WORKER_THRESHOLD,
      workerFactory: createDemoPivotWorker
    });
    return () => workerRef.current?.terminate();
  }, [useWorker, options.workerThreshold]);

  useEffect(() => {
    if (!fields.length) return;
    setConfig((prev) => {
      if (!isEmptyPivotConfig(prev)) return prev;
      if (options.initialConfig?.values?.length || options.initialConfig?.rows?.length) {
        return prev;
      }
      const defaults = createDefaultPivotConfig(fields);
      if (!defaults.values?.length) return prev;
      return { ...prev, ...defaults };
    });
  }, [fields, options.initialConfig?.rows?.length, options.initialConfig?.values?.length]);

  useEffect(() => {
    if (!rawData.length || !config.values.length) {
      setPivotData(null);
      setIsComputing(false);
      return;
    }

    let cancelled = false;
    setIsComputing(true);

    const compute = async () => {
      try {
        const client = workerRef.current;
        const viaWorker = client?.shouldUseWorker(rawData.length);
        const result =
          viaWorker && client
            ? await client.compute(rawData, fields, config)
            : engineRef.current.compute(rawData, fields, config);
        if (!cancelled) setPivotData(result);
      } catch {
        if (!cancelled) {
          try {
            setPivotData(engineRef.current.compute(rawData, fields, config));
          } catch {
            setPivotData(null);
          }
        }
      } finally {
        if (!cancelled) setIsComputing(false);
      }
    };

    void compute();
    return () => {
      cancelled = true;
    };
  }, [rawData, fields, config]);

  const addField = useCallback((zone: BuilderZone, fieldId: string) => {
    setConfig((prev) => {
      if (zone === "values") {
        if (prev.values.some((v) => v.fieldId === fieldId)) return prev;
        return { ...prev, values: [...prev.values, { fieldId, aggregation: "SUM" }] };
      }
      if (zone === "reportFilters") {
        if (prev.reportFilters.includes(fieldId)) return prev;
        return { ...prev, reportFilters: [...prev.reportFilters, fieldId] };
      }
      if (prev[zone].includes(fieldId)) return prev;
      return { ...prev, [zone]: [...prev[zone], fieldId] };
    });
  }, []);

  const removeField = useCallback((zone: BuilderZone, fieldId: string) => {
    setConfig((prev) => {
      if (zone === "values") {
        return { ...prev, values: prev.values.filter((v) => v.fieldId !== fieldId) };
      }
      if (zone === "reportFilters") {
        return {
          ...prev,
          reportFilters: prev.reportFilters.filter((f) => f !== fieldId),
          filters: prev.filters.filter((f) => f.fieldId !== fieldId)
        };
      }
      return {
        ...prev,
        [zone]: prev[zone].filter((f) => f !== fieldId),
        filters: prev.filters.filter((f) => f.fieldId !== fieldId)
      };
    });
  }, []);

  const updateValueAggregation = useCallback((fieldId: string, aggregation: AggregationType) => {
    setConfig((prev) => ({
      ...prev,
      values: prev.values.map((v) => (v.fieldId === fieldId ? { ...v, aggregation } : v))
    }));
  }, []);

  const reorderFields = useCallback(
    (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => {
      setConfig((prev) => ({ ...prev, [zone]: fieldIds }));
    },
    []
  );

  const reorderValueFields = useCallback((fieldIds: string[]) => {
    setConfig((prev) => {
      const byId = new Map(prev.values.map((v) => [v.fieldId, v]));
      const next = fieldIds.map((id) => byId.get(id)).filter(Boolean) as typeof prev.values;
      if (next.length !== prev.values.length) return prev;
      return { ...prev, values: next };
    });
  }, []);

  const setFilter = useCallback((filter: PivotFilter | null, fieldId?: string) => {
    setConfig((prev) => {
      const id = filter?.fieldId ?? fieldId;
      if (!id) return prev;
      if (!filter) {
        return { ...prev, filters: prev.filters.filter((f) => f.fieldId !== id) };
      }
      return {
        ...prev,
        filters: [...prev.filters.filter((f) => f.fieldId !== filter.fieldId), filter]
      };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setConfig((prev) => ({ ...prev, filters: [] }));
  }, []);

  const setSortBy = useCallback((fieldId: string) => {
    setConfig((prev) => {
      const current = prev.options.sortBy;
      const direction =
        current?.fieldId === fieldId && current.direction === "asc" ? "desc" : "asc";
      return {
        ...prev,
        options: { ...prev.options, sortBy: { fieldId, direction } }
      };
    });
  }, []);

  const toggleRow = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!pivotData?.rows.length) return;
    setExpandedRows(new Set(collectExpandableRowKeys(pivotData.rows)));
  }, [pivotData]);

  const collapseAll = useCallback(() => setExpandedRows(new Set()), []);

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_PIVOT_CONFIG, ...options.initialConfig });
    setExpandedRows(new Set());
  }, [options.initialConfig]);

  const openDrillThrough = useCallback(
    (cell: PivotCell) => {
      if (!cell.drillContext) return;
      const enrichedFields = [
        ...fields,
        ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])
      ];
      const records = engineRef.current.getDrillThroughRecords(rawData, enrichedFields, config, {
        rowGroupKey: cell.drillContext.rowGroupKey,
        columnKey: cell.columnKey,
        valueFieldId: cell.drillContext.valueFieldId
      });
      setDrillRecords(records);
      setDrillCell(cell);
      setDrillOpen(true);
    },
    [rawData, fields, config]
  );

  const closeDrillThrough = useCallback(() => {
    setDrillOpen(false);
    setDrillCell(null);
    setDrillRecords([]);
  }, []);

  const addCalculatedPreset = useCallback((presetId: string) => {
    const preset = CALCULATED_MEASURE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const measure: CalculatedMeasure = {
      id: `calc_${preset.id}`,
      label: preset.label,
      formula: preset.formula
    };
    setConfig((prev) => {
      if (prev.calculatedMeasures?.some((m) => m.id === measure.id)) return prev;
      return {
        ...prev,
        calculatedMeasures: [...(prev.calculatedMeasures ?? []), measure],
        values: prev.values.some((v) => v.fieldId === measure.id)
          ? prev.values
          : [...prev.values, { fieldId: measure.id, label: measure.label, aggregation: "SUM" }]
      };
    });
  }, []);

  const addCalculatedMeasure = useCallback((measure: CalculatedMeasure) => {
    setConfig((prev) => {
      if (prev.calculatedMeasures?.some((m) => m.id === measure.id)) return prev;
      return {
        ...prev,
        calculatedMeasures: [...(prev.calculatedMeasures ?? []), measure],
        values: prev.values.some((v) => v.fieldId === measure.id)
          ? prev.values
          : [...prev.values, { fieldId: measure.id, label: measure.label, aggregation: "SUM" }]
      };
    });
  }, []);

  const updateCalculatedMeasure = useCallback(
    (id: string, patch: Partial<Omit<CalculatedMeasure, "id">>) => {
      setConfig((prev) => ({
        ...prev,
        calculatedMeasures: (prev.calculatedMeasures ?? []).map((m) =>
          m.id === id ? { ...m, ...patch, id: m.id } : m
        ),
        values: prev.values.map((v) =>
          v.fieldId === id && patch.label ? { ...v, label: patch.label } : v
        )
      }));
    },
    []
  );

  const removeCalculatedMeasure = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      calculatedMeasures: (prev.calculatedMeasures ?? []).filter((m) => m.id !== id),
      values: prev.values.filter((v) => v.fieldId !== id)
    }));
  }, []);

  const toggleColumnTotals = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      options: { ...prev.options, showColumnTotals: !prev.options.showColumnTotals }
    }));
  }, []);

  const updateConfig = useCallback((patch: Partial<PivotConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...patch,
      options: { ...prev.options, ...patch.options }
    }));
  }, []);

  const usingWorker = useMemo(
    () => Boolean(workerRef.current?.shouldUseWorker(rawData.length)),
    [rawData.length, isComputing]
  );

  return {
    config,
    pivotData,
    isComputing,
    usingWorker,
    expandedRows,
    drillOpen,
    drillRecords,
    drillCell,
    addField,
    removeField,
    reorderFields,
    reorderValueFields,
    updateValueAggregation,
    setFilter,
    clearAllFilters,
    setSortBy,
    toggleRow,
    expandAll,
    collapseAll,
    resetConfig,
    openDrillThrough,
    closeDrillThrough,
    addCalculatedPreset,
    addCalculatedMeasure,
    updateCalculatedMeasure,
    removeCalculatedMeasure,
    toggleColumnTotals,
    updateConfig,
    hasData: Boolean(pivotData?.rows.length),
    activeFilterCount: config.filters.length
  };
}
