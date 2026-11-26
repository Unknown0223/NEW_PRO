"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PivotField } from "@salec/pivot-engine";
import {
  collectExpandableRowKeys,
  pivotToChartData,
  summarizePivotFilter
} from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  mapMultiOptions,
  mapSelectOptions
} from "@/components/reports/flat-report/flat-report-helpers";
import type { FlatReportSelectField } from "@/components/reports/flat-report/types";
import { usePivot } from "@/hooks/pivot/usePivot";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import { UNIVERSAL_BONUSES_FILTER_CONFIG } from "./universal-bonuses-filter-config";
import {
  buildUniversalBonusesFlatPivotConfig,
  UNIVERSAL_BONUSES_PIVOT_FIELDS
} from "./universal-bonuses-pivot-fields";

type DatasetPayload = {
  fields: Array<{ id: string; label: string; dataType: string }>;
  rows: Record<string, unknown>[];
  total: number;
  truncated: boolean;
};

/** Filters + dataset + usePivot for universal-bonuses VP. */
export function useUniversalBonusesPivot(fieldsOpen: boolean) {
  const cfg = UNIVERSAL_BONUSES_FILTER_CONFIG;
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [draft, setDraft] = useState(() => buildEmptyDraft(cfg.filterFields, from0, to0, 50));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-universal-bonuses-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, unknown> }>(
        `/api/${tenantSlug}/reports/universal-bonuses/filter-options`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!filtersQ.data) return;
    setDraft((d) => applyOptionsDefaults(d, cfg.filterFields, filtersQ.data));
    setApplied((a) => applyOptionsDefaults(a, cfg.filterFields, filtersQ.data));
  }, [filtersQ.data, cfg.filterFields]);

  const datasetQ = useQuery({
    queryKey: ["report-universal-bonuses-dataset", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, { ...applied, page: 1, limit: 5000 });
      const { data } = await api.get<{ data: DatasetPayload }>(
        `/api/${tenantSlug}/reports/universal-bonuses/dataset?${p.toString()}`
      );
      return data.data;
    }
  });

  const pivotFields: PivotField[] = useMemo(() => {
    const fromApi = datasetQ.data?.fields;
    if (!fromApi?.length) return UNIVERSAL_BONUSES_PIVOT_FIELDS;
    return fromApi.map((f) => ({
      id: f.id,
      label: f.label,
      dataType: (f.dataType as PivotField["dataType"]) || "string"
    }));
  }, [datasetQ.data?.fields]);

  const rawRows = datasetQ.data?.rows ?? [];
  const pivot = usePivot(rawRows, pivotFields, {
    initialConfig: buildUniversalBonusesFlatPivotConfig(),
    suspendCompute: fieldsOpen
  });

  const currentLayoutForm = resolveLayoutForm(pivot.config.options);
  const layoutLabel =
    currentLayoutForm === "flat"
      ? "Табличная"
      : currentLayoutForm === "compact"
        ? "Компактная"
        : "Классическая";
  const expandableRowKeys = useMemo(
    () => (pivot.pivotData?.rows?.length ? collectExpandableRowKeys(pivot.pivotData.rows) : []),
    [pivot.pivotData]
  );
  const hierarchyExpanded =
    expandableRowKeys.length > 0 &&
    expandableRowKeys.some((key) => pivot.expandedRows.has(key));
  const chartData = useMemo(
    () => (pivot.pivotData ? pivotToChartData(pivot.pivotData) : null),
    [pivot.pivotData]
  );
  const filterSummaries = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of pivot.config.filters) {
      const summary = summarizePivotFilter(f);
      if (summary) map[f.fieldId] = summary;
    }
    return map;
  }, [pivot.config.filters]);
  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, ReturnType<typeof mapMultiOptions>> = {};
    for (const field of cfg.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [filtersQ.data, cfg.filterFields]);

  const dateTypeField = cfg.filterFields.find(
    (f): f is FlatReportSelectField => f.kind === "select" && f.paramKey === "date_type"
  );
  const dateTypeOptions = dateTypeField
    ? dateTypeField.staticOptions ??
      mapSelectOptions(
        dateTypeField.optionsFrom ? filtersQ.data?.[dateTypeField.optionsFrom] : undefined
      )
    : [];

  return {
    cfg,
    from0,
    to0,
    draft,
    setDraft,
    applied,
    setApplied,
    filtersQ,
    datasetQ,
    pivotFields,
    rawRows,
    pivot,
    currentLayoutForm,
    layoutLabel,
    expandableRowKeys,
    hierarchyExpanded,
    chartData,
    filterSummaries,
    multiItemsByKey,
    dateTypeField,
    dateTypeOptions
  };
}
