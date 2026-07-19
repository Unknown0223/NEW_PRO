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
  hydratePivotValueLabels,
  isEmptyPivotConfig,
  RETROBONUS_TIER_PRESETS,
  getPivotStrings,
  valuesOnRows,
  yieldToMain,
  type AggregationType,
  type CalculatedMeasure,
  type PivotCell,
  type PivotConfig,
  type PivotData,
  type PivotField,
  type PivotFilter,
  type PivotWorkerClient
} from "@salec/pivot-engine";
import { buildFlatPivotData, buildFlatPivotDataAsync } from "@/lib/build-flat-pivot-data";
import { createNextWorkerFactory } from "@/lib/create-pivot-worker";
import { hasFlatSlice, resolveLayoutForm } from "@/lib/pivot-layout-form";

export { DEFAULT_PIVOT_CONFIG };

/** Klassikda avtomatik expand — shu dan ortiq guruh bo‘lsa faqat 1-daraja. */
const CLASSIC_AUTO_EXPAND_MAX_KEYS = 250;
/** Shundan katta flat dataset — async batch. */
const FLAT_ASYNC_THRESHOLD = 2_000;

type BuilderZone = "rows" | "columns" | "values" | "reportFilters";

type UsePivotOptions = {
  initialConfig?: Partial<PivotConfig>;
  onConfigChange?: (config: PivotConfig) => void;
  workerThreshold?: number;
  useWorker?: boolean;
  /** Fields modal ochiq — og‘ir pivot hisobini to‘xtatish. */
  suspendCompute?: boolean;
};

/** Next/SALEC drop-in — same shape as `@salec/pivot-ui` createNextWorkerFactory. */
const createFrontendPivotWorker = createNextWorkerFactory(
  new URL("../../workers/pivot.worker.ts", import.meta.url)
);

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
  const [computeError, setComputeError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const classicSeededExpandRef = useRef(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRecords, setDrillRecords] = useState<Record<string, unknown>[]>([]);
  const [drillCell, setDrillCell] = useState<PivotCell | null>(null);

  const useWorker = options.useWorker !== false;

  useEffect(() => {
    // Vendor pivot-engine yangilanganda eski instance / worker keshini tashla.
    engineRef.current = new PivotEngine();
  }, []);

  useEffect(() => {
    if (!useWorker || typeof Worker === "undefined") return;
    workerRef.current?.terminate();
    workerRef.current = createPivotWorkerClient({
      threshold: options.workerThreshold ?? DEFAULT_WORKER_THRESHOLD,
      workerFactory: createFrontendPivotWorker
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

  /** Backfill measure captions from field catalog (Поля labels) for legacy/template configs. */
  useEffect(() => {
    if (!fields.length) return;
    setConfig((prev) => {
      if (!prev.values.length) return prev;
      const values = hydratePivotValueLabels(prev.values, fields);
      if (values.every((v, i) => v.label === prev.values[i]?.label)) return prev;
      return { ...prev, values };
    });
  }, [fields]);

  useEffect(() => {
    if (options.suspendCompute) {
      setIsComputing(false);
      return;
    }
    if (!rawData.length) {
      setPivotData(null);
      setIsComputing(false);
      setComputeError(null);
      return;
    }

    const layoutForm = resolveLayoutForm(config.options);
    const canCompute =
      layoutForm === "flat" ? hasFlatSlice(config) : config.values.length > 0;

    if (!canCompute) {
      setPivotData(null);
      setIsComputing(false);
      setComputeError(null);
      return;
    }

    let cancelled = false;
    setIsComputing(true);
    setComputeError(null);

    const compute = async () => {
      try {
        // Spinner chizilishi uchun UI ga nafas berish
        await yieldToMain();
        if (cancelled) return;

        if (layoutForm === "flat") {
          const result =
            rawData.length >= FLAT_ASYNC_THRESHOLD
              ? await buildFlatPivotDataAsync(rawData, fields, config)
              : buildFlatPivotData(rawData, fields, config);
          if (!cancelled) {
            setPivotData(result);
            setExpandedRows(new Set());
            setComputeError(null);
          }
          return;
        }

        const client = workerRef.current;
        const viaWorker = client?.shouldUseWorker(rawData.length);
        if (!viaWorker && rawData.length >= FLAT_ASYNC_THRESHOLD) {
          await yieldToMain();
        }
        const result =
          viaWorker && client
            ? await client.compute(rawData, fields, config)
            : engineRef.current.compute(rawData, fields, config);
        if (!cancelled) {
          setPivotData(result);
          setComputeError(null);
        }
      } catch (error) {
        console.error("Pivot hisoblash xatosi:", error);
        if (cancelled) return;
        const detail =
          error instanceof Error
            ? error.message.slice(0, 180)
            : typeof error === "string"
              ? error.slice(0, 180)
              : undefined;
        try {
          await yieldToMain();
          const fallback =
            layoutForm === "flat"
              ? await buildFlatPivotDataAsync(rawData, fields, config)
              : engineRef.current.compute(rawData, fields, config);
          setPivotData(fallback);
          if (layoutForm === "flat") setExpandedRows(new Set());
          setComputeError(
            getPivotStrings().reportBuilder.computeFailed(
              detail ? `${detail} (показан запасной расчёт)` : "показан запасной расчёт"
            )
          );
        } catch (fallbackErr) {
          console.error("Pivot fallback xatosi:", fallbackErr);
          setPivotData(null);
          setComputeError(getPivotStrings().reportBuilder.computeFailed(detail));
        }
      } finally {
        if (!cancelled) setIsComputing(false);
      }
    };

    void compute();
    return () => {
      cancelled = true;
    };
  }, [rawData, fields, config, options.suspendCompute]);

  const updateConfig = useCallback(
    (updates: Partial<PivotConfig>) => {
      setConfig((prev) => {
        const next: PivotConfig = {
          ...prev,
          ...updates,
          options: updates.options
            ? { ...prev.options, ...updates.options }
            : prev.options
        };
        options.onConfigChange?.(next);
        return next;
      });
    },
    [options]
  );

  const addField = useCallback(
    (zone: BuilderZone, fieldId: string, aggregation: "SUM" | "COUNT" | "AVG" = "SUM") => {
      setConfig((prev) => {
        if (zone === "values") {
          if (prev.values.some((v) => v.fieldId === fieldId)) return prev;
          const label = fields.find((f) => f.id === fieldId)?.label;
          return {
            ...prev,
            values: [...prev.values, { fieldId, aggregation, ...(label ? { label } : {}) }]
          };
        }
        if (zone === "reportFilters") {
          if (prev.reportFilters.includes(fieldId)) return prev;
          return { ...prev, reportFilters: [...prev.reportFilters, fieldId] };
        }
        if (prev[zone].includes(fieldId)) return prev;
        return { ...prev, [zone]: [...prev[zone], fieldId] };
      });
    },
    [fields]
  );

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

  const reorderFields = useCallback(
    (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => {
      setConfig((prev) => ({ ...prev, [zone]: fieldIds }));
    },
    []
  );

  /** Flat forma: ustun tartibi faqat `rows` da saqlanadi. */
  const setFlatColumnOrder = useCallback((fieldIds: string[]) => {
    setConfig((prev) => ({
      ...prev,
      rows: fieldIds,
      columns: [],
      values: []
    }));
  }, []);

  /** Value ustunlarini sudrab almashtirish (klassik/kompakt). */
  const reorderValueFields = useCallback((fieldIds: string[]) => {
    setConfig((prev) => {
      const byId = new Map(prev.values.map((v) => [v.fieldId, v]));
      const next = fieldIds.map((id) => byId.get(id)).filter(Boolean) as typeof prev.values;
      if (next.length !== prev.values.length) return prev;
      return { ...prev, values: next };
    });
  }, []);

  const updateValueAggregation = useCallback((fieldId: string, aggregation: AggregationType) => {
    setConfig((prev) => ({
      ...prev,
      values: prev.values.map((v) => (v.fieldId === fieldId ? { ...v, aggregation } : v))
    }));
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

  const clearFilter = useCallback((fieldId: string) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.fieldId !== fieldId)
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setConfig((prev) => ({ ...prev, filters: [] }));
  }, []);

  const setSortBy = useCallback((fieldId: string) => {
    setConfig((prev) => {
      const current = prev.options.sortBy;
      const direction =
        current?.fieldId === fieldId && current.direction === "asc" ? "desc" : "asc";
      const next = {
        ...prev,
        options: { ...prev.options, sortBy: { fieldId, direction } as const }
      };
      options.onConfigChange?.(next);
      return next;
    });
  }, [options]);

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

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  // Klassik: birinchi ochilishda expand (katta daraxtlarda faqat 1-daraja).
  // Data rebuild da eskirgan keylarni tozalaymiz.
  useEffect(() => {
    if (resolveLayoutForm(config.options) !== "classic") {
      classicSeededExpandRef.current = false;
      return;
    }
    if (!pivotData?.rows.length || isComputing) return;
    const keys = collectExpandableRowKeys(pivotData.rows);
    if (!keys.length) return;
    const seedKeys =
      keys.length > CLASSIC_AUTO_EXPAND_MAX_KEYS
        ? keys.filter((k) => !k.includes(" | "))
        : keys;
    const seedSet = seedKeys.length ? seedKeys : keys.slice(0, CLASSIC_AUTO_EXPAND_MAX_KEYS);
    const keySet = new Set(keys);
    setExpandedRows((prev) => {
      if (prev.size === 0) {
        if (!classicSeededExpandRef.current) {
          classicSeededExpandRef.current = true;
          return new Set(seedSet);
        }
        return prev;
      }
      classicSeededExpandRef.current = true;
      let changed = false;
      const next = new Set<string>();
      for (const k of prev) {
        if (keySet.has(k)) next.add(k);
        else changed = true;
      }
      if (next.size === 0) return new Set(seedSet);
      return changed ? next : prev;
    });
  }, [config.options, config.rows, pivotData, isComputing]);

  /** WDR «Σ Values in Rows»: drill-down daraxtida ota qatorlar ochiq bo‘lishi kerak. */
  useEffect(() => {
    if (resolveLayoutForm(config.options) === "flat") return;
    if (!valuesOnRows(config.options)) return;
    if (!pivotData?.rows.length || isComputing) return;

    const keys = collectExpandableRowKeys(pivotData.rows);
    if (!keys.length) return;

    setExpandedRows((prev) => {
      const all = new Set(keys);
      if (all.size === prev.size && keys.every((k) => prev.has(k))) return prev;
      return all;
    });
  }, [config.options.valuesPosition, config.options, pivotData, isComputing]);

  const clearComputeError = useCallback(() => setComputeError(null), []);

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

  const addCalculatedPreset = useCallback(
    (presetId: string) => {
      const preset = CALCULATED_MEASURE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      let label = preset.label;
      if (preset.tierPresetId) {
        const tier = RETROBONUS_TIER_PRESETS.find((t) => t.id === preset.tierPresetId);
        if (tier) label = `${label} — ${tier.label}`;
      }
      addCalculatedMeasure({
        id: `calc_${preset.id}`,
        label,
        formula: preset.formula
      });
    },
    [addCalculatedMeasure]
  );

  const removeCalculatedMeasure = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      calculatedMeasures: (prev.calculatedMeasures ?? []).filter((m) => m.id !== id),
      values: prev.values.filter((v) => v.fieldId !== id)
    }));
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

  const toggleColumnTotals = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      options: { ...prev.options, showColumnTotals: !prev.options.showColumnTotals }
    }));
  }, []);

  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  const activeFilterCount = config.filters.length;

  const usingWorker = useMemo(
    () => Boolean(workerRef.current?.shouldUseWorker(rawData.length)),
    [rawData.length, isComputing]
  );

  return {
    config,
    pivotData,
    isComputing,
    computeError,
    clearComputeError,
    usingWorker,
    expandedRows,
    drillOpen,
    drillRecords,
    drillCell,
    updateConfig,
    addField,
    removeField,
    reorderFields,
    setFlatColumnOrder,
    reorderValueFields,
    updateValueAggregation,
    toggleRow,
    setFilter,
    clearFilter,
    clearAllFilters,
    setSortBy,
    expandAll,
    collapseAll,
    resetConfig,
    openDrillThrough,
    closeDrillThrough,
    addCalculatedMeasure,
    addCalculatedPreset,
    removeCalculatedMeasure,
    updateCalculatedMeasure,
    toggleColumnTotals,
    hasData: Boolean(pivotData?.rows.length),
    activeFilterCount,
    fieldMap
  };
}
