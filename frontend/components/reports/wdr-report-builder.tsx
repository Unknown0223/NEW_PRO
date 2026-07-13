"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportBuilderPivotHeight } from "./wdr/use-report-builder-pivot-height";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  isWdrSavedConfig,
  migrateLegacyReportBuilderConfigToWdrReport,
  normalizeSavedDatasetFilters,
  type LegacyConfigPayload,
  type WdrReportJson
} from "@/lib/report-builder-wdr-migrate";
import {
  DATASET_ID,
  axiosErrorFields,
  buildCaptionMap,
  buildWdrMapping,
  createWdrToolbarConfigurer,
  defaultFilters,
  emptyWdrReport,
  getPivotApi,
  parseTerritoryNodeList,
  reportBuilderDatasetFailureMessage,
  scheduleWdrLayoutRefresh,
  territoryFromNodes,
  tryGetWdrReportJson,
  wdrSeedRowFromMetadata,
  closeOpenWdrPopups,
  hasVisibleWdrPopup,
  setNativeToolbarTemporaryVisibility,
  clickHiddenNativeToolbarAction,
  clickWdrToolbarTabByKind,
  clickWdrMenuItemByLabels,
  logWdrPopupDiagnostics,
  applyConditionalFormattingToHost,
  runWdrExpandCollapseAll,
  localizeWdrTextNodes,
  localizeWdrTextValue,
  type ConditionalRule,
  type DatasetApiRow,
  type DatasetFieldMeta,
  type DatasetResponse,
  type FilterState,
  type Metadata,
  type FilterOpts,
  type PivotClass,
  type WdrPivotApi,
  type WdrToolbarActions,
  type WdrToolbarLike
} from "./wdr/wdr-report-builder.utils";
import { WdrReportBuilderFiltersPanel } from "./wdr/wdr-report-builder-filters-panel";
import { WdrReportBuilderPivotSection } from "./wdr/wdr-report-builder-pivot-section";

export default function WdrReportBuilder() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const pivotRef = useRef<PivotClass | null>(null);
  const pivotWrapRef = useRef<HTMLDivElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const pivotViewportPx = useReportBuilderPivotHeight();
  const [hierarchyExpanded, setHierarchyExpanded] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [formatCellsDialogOpen, setFormatCellsDialogOpen] = useState(false);
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedReportsDialogOpen, setSavedReportsDialogOpen] = useState(false);
  const [activeSavedReportId, setActiveSavedReportId] = useState<number | null>(null);
  const [cellFormatPattern, setCellFormatPattern] = useState("#,##0.00");
  const [conditionalThreshold] = useState("0");
  const [formatValueScope, setFormatValueScope] = useState("selected");
  const [formatAlign, setFormatAlign] = useState("right");
  const [formatThousands, setFormatThousands] = useState("space");
  const [formatDecimalSep, setFormatDecimalSep] = useState(".");
  const [formatDecimalPlaces, setFormatDecimalPlaces] = useState("2");
  const [formatNegatives, setFormatNegatives] = useState("-1");
  const [formatNullValue, setFormatNullValue] = useState("-");
  const [formatAsPercent, setFormatAsPercent] = useState("false");
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([
    {
      id: `r-${Date.now()}`,
      scope: "all",
      operator: "lt",
      threshold: "0",
      fontName: "Arial",
      fontSize: "12px",
      color: "#ef4444"
    }
  ]);
  const [filters, setFilters] = useState<FilterState>(() => defaultFilters());
  const [saveName, setSaveName] = useState("");
  const [lastDataset, setLastDataset] = useState<DatasetResponse | null>(null);
  const pivotReadyRef = useRef(false);
  const lastWdrReportRef = useRef<WdrReportJson>(emptyWdrReport());
  const toolbarActionsRef = useRef<WdrToolbarActions>({});
  const toolbarRef = useRef<WdrToolbarLike | null>(null);
  const captionMapRef = useRef<Record<string, string>>({});
  const keepToolbarVisibleUntilRef = useRef(0);

  const syncPivotSnapshot = useCallback(() => {
    const wdr = getPivotApi(pivotRef);
    if (!wdr) return;
    const plain = tryGetWdrReportJson(wdr);
    if (plain) lastWdrReportRef.current = plain;
  }, []);

  const metaQ = useQuery({
    queryKey: ["report-builder-metadata", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Metadata }>(`/api/${tenantSlug}/reports/report-builder/metadata`);
      return data.data;
    }
  });

  const filtersQ = useQuery({
    queryKey: ["report-builder-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOpts }>(`/api/${tenantSlug}/reports/report-builder/filter-options`);
      return data.data;
    }
  });

  const savedQ = useQuery({
    queryKey: ["report-builder-saved", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; name: string; config: LegacyConfigPayload | WdrReportJson }>;
      }>(`/api/${tenantSlug}/reports/report-builder/saved`);
      return data.data;
    }
  });
  const profileQ = useQuery({
    queryKey: ["tenant-settings-profile", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown>>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const datasetMut = useMutation({
    mutationFn: async (body: FilterState) => {
      const { data } = await api.post<{ data: DatasetResponse }>(
        `/api/${tenantSlug}/reports/report-builder/dataset`,
        body
      );
      return data.data;
    },
    onSuccess: (d) => setLastDataset(d),
    onError: (err: unknown) => {
      const ax = err as { response?: { status?: number; data?: unknown } };
      const status = ax.response?.status;
      const { error, message } = axiosErrorFields(ax.response?.data);
      void status;
      void error;
      void message;
    }
  });

  const saveMut = useMutation({
    mutationFn: async (configToSave: WdrReportJson) => {
      const name = saveName.trim();
      if (!name) throw new Error("EMPTY_NAME");
      await api.post(`/api/${tenantSlug}/reports/report-builder/saved`, { name, config: configToSave });
    },
    onSuccess: () => {
      setSaveName("");
      void qc.invalidateQueries({ queryKey: ["report-builder-saved", tenantSlug] });
    }
  });

  const applyDatasetToPivot = useCallback(
    (rows: DatasetApiRow[], baseReport: WdrReportJson, fieldsMeta: DatasetFieldMeta[] = []) => {
      const wdr = getPivotApi(pivotRef);
      if (!wdr) return;
      const mapping = buildWdrMapping(fieldsMeta);
      const next: WdrReportJson = {
        ...baseReport,
        dataSource: {
          dataSourceType: "json",
          data: rows as object[],
          ...(Object.keys(mapping).length ? { mapping } : {})
        },
        savdoDatasetFilters: { ...filters, datasetId: DATASET_ID }
      };
      lastWdrReportRef.current = next;
      wdr.setReport(next as never);
      scheduleWdrLayoutRefresh(wdr);
    },
    [filters]
  );

  const loadData = useCallback(async () => {
    const d = await datasetMut.mutateAsync(filters);
    captionMapRef.current = buildCaptionMap(d.fields);
    requestAnimationFrame(() => {
      syncPivotSnapshot();
      const prev = lastWdrReportRef.current;
      const base: WdrReportJson = {
        ...prev,
        slice: prev.slice ?? emptyWdrReport().slice
      };
      applyDatasetToPivot(d.rows, base, d.fields);
    });
  }, [applyDatasetToPivot, datasetMut, filters, syncPivotSnapshot]);

  const loadDefaultReport = useCallback(async () => {
    if (lastDataset) {
      syncPivotSnapshot();
      const prev = lastWdrReportRef.current;
      const base: WdrReportJson = {
        ...prev,
        slice: prev.slice ?? emptyWdrReport().slice
      };
      applyDatasetToPivot(lastDataset.rows, base, lastDataset.fields);
    } else {
      await loadData();
    }
    setActiveSavedReportId(null);
  }, [applyDatasetToPivot, lastDataset, loadData, syncPivotSnapshot]);

  useEffect(() => {
    if (!pivotReadyRef.current) return;
    scheduleWdrLayoutRefresh(getPivotApi(pivotRef));
  }, [pivotViewportPx]);

  const onSave = useCallback(async (): Promise<boolean> => {
    const wdr = getPivotApi(pivotRef);
    if (!wdr || !pivotReadyRef.current) {
      window.alert("Таблица ещё не готова");
      return false;
    }
    const plain = tryGetWdrReportJson(wdr) ?? lastWdrReportRef.current;
    const out: WdrReportJson = {
      ...plain,
      savdoDatasetFilters: { ...filters, datasetId: DATASET_ID },
      dataSource: {
        ...plain.dataSource,
        dataSourceType: "json",
        data: []
      }
    };
    try {
      await saveMut.mutateAsync(out);
      return true;
    } catch (err: unknown) {
      window.alert(getUserFacingError(err, "Ошибка сохранения"));
      return false;
    }
  }, [filters, saveMut]);

  const onBrowserExport = useCallback(() => {
    const wdr = getPivotApi(pivotRef);
    if (!wdr || !pivotReadyRef.current) {
      window.alert("Таблица ещё не готова");
      return;
    }
    wdr.exportTo("excel");
  }, []);

  const onToggleFullscreen = useCallback(() => {
    const el = pivotWrapRef.current;
    if (!el || typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen?.();
  }, []);

  const runToolbarAction = useCallback((kind: keyof WdrToolbarActions) => {
    const host = pivotWrapRef.current;
    const tb = toolbarRef.current;
    const wdr = getPivotApi(pivotRef);
    // Native pivot APIs: do not flash/reveal the WDR toolbar row — it tears down open dialogs
    // when MutationObserver + hideInternalToolbar run shortly after.

    if (kind === "options" && typeof wdr?.showOptionsDialog === "function") {
      try {
        if (host) closeOpenWdrPopups(host);
        wdr.showOptionsDialog();
        console.debug("[WDR] options opened via pivot api");
        if (host) window.setTimeout(() => logWdrPopupDiagnostics(), 40);
        return true;
      } catch (e) {
        void e;
      }
    }

    if (kind === "fields" && typeof wdr?.openFieldsList === "function") {
      try {
        if (host) closeOpenWdrPopups(host);
        wdr.openFieldsList();
        console.debug("[WDR] fields opened via pivot api");
        return true;
      } catch (e) {
        void e;
      }
    }

    if (kind === "format" && typeof wdr?.showFormattingDialog === "function") {
      try {
        if (host) closeOpenWdrPopups(host);
        wdr.showFormattingDialog();
        console.debug("[WDR] format opened via pivot api");
        return true;
      } catch (e) {
        void e;
      }
    }

    if (host && (kind === "options" || kind === "fields" || kind === "format")) {
      console.debug("[WDR] runToolbarAction:dom-fallback", { kind });
      closeOpenWdrPopups(host);
      keepToolbarVisibleUntilRef.current = Date.now() + 30_000;
      setNativeToolbarTemporaryVisibility(host, true);
    }

    if (kind === "fields" && host) {
      const clicked = clickHiddenNativeToolbarAction(host, "fields");
      if (clicked) return true;
      if (!hasVisibleWdrPopup(host)) setNativeToolbarTemporaryVisibility(host, false);
    }

    if (kind === "options" && tb?.showOptionsDialog) {
      try {
        tb.showOptionsDialog();
        if (host) window.setTimeout(() => logWdrPopupDiagnostics(), 40);
        return true;
      } catch (e) {
        void e;
      }
    }

    const h = toolbarActionsRef.current[kind];
    if (typeof h === "function") {
      try {
        h();
        console.debug("[WDR] action opened via captured toolbar handler", { kind });
        return true;
      } catch (e) {
        void e;
      }
    }
    // One more fallback if actions were not captured.
    try {
      if (kind === "options" && tb?.showOptionsDialog) {
        tb.showOptionsDialog();
        if (host) window.setTimeout(() => logWdrPopupDiagnostics(), 40);
        return true;
      }
      if (kind === "fields" && tb?.openFieldsList) {
        tb.openFieldsList();
        return true;
      }
      if (kind === "format" && tb?.showFormattingDialog) {
        tb.showFormattingDialog();
        return true;
      }
    } catch (e) {
      void e;
    }
    if (host && (kind === "options" || kind === "fields")) {
      const clicked = clickHiddenNativeToolbarAction(host, kind);
      if (clicked) return true;
      if (!hasVisibleWdrPopup(host)) setNativeToolbarTemporaryVisibility(host, false);
    }
    if (host && kind === "format") {
      const clicked = clickHiddenNativeToolbarAction(host, "format") || clickWdrToolbarTabByKind(host, "format");
      if (clicked) {
        console.debug("[WDR] format tab clicked; trying submenu item");
        // In this WDR build, "Format" often opens a submenu first.
        // Auto-pick the "Formatting..." item to open the actual modal.
        window.setTimeout(() => {
          const picked = clickWdrMenuItemByLabels(host, [
            "Форматирование",
            "Форматирование ячеек",
            "Formatting",
            "Format cells"
          ]);
          console.debug("[WDR] format submenu pick result", { picked });
        }, 60);
        return true;
      }
      if (!hasVisibleWdrPopup(host)) setNativeToolbarTemporaryVisibility(host, false);
    }
    console.debug("[WDR] runToolbarAction:failed", { kind });
    return false;
  }, []);

  const beforeToolbarCreated = useMemo(
    () => createWdrToolbarConfigurer(toolbarActionsRef, toolbarRef),
    []
  );
  const pivotMountKey = `${tenantSlug ?? ""}-rb-${(metaQ.data?.fields?.length ?? 0) > 0 ? "meta" : "pending"}`;

  const hideInternalToolbar = useCallback(() => {
    const host = pivotWrapRef.current;
    if (!host) return;
    // While a WDR modal is open, never collapse the native toolbar — WDR closes the dialog with it.
    if (hasVisibleWdrPopup(host)) return;
    if (Date.now() < keepToolbarVisibleUntilRef.current) {
      setNativeToolbarTemporaryVisibility(host, true);
      return;
    }
    // UX requirement: internal WDR toolbar row must stay hidden.
    // Custom top controls drive the same actions.
    setNativeToolbarTemporaryVisibility(host, false);
  }, []);

  useEffect(() => {
    const host = pivotWrapRef.current;
    if (!host) return;
    applyConditionalFormattingToHost(host, conditionalRules);
    const observer = new MutationObserver(() => applyConditionalFormattingToHost(host, conditionalRules));
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [conditionalRules, pivotMountKey]);

  const onToggleHierarchy = useCallback(() => {
    const wdr = getPivotApi(pivotRef);
    if (!wdr || !pivotReadyRef.current) {
      window.alert("Таблица ещё не готова");
      return;
    }
    const nextMode: "expand" | "collapse" = hierarchyExpanded ? "collapse" : "expand";
    const ok = runWdrExpandCollapseAll(wdr, nextMode);
    if (!ok) {
      window.alert(nextMode === "expand" ? "Развернуть всё пока недоступно" : "Свернуть всё пока недоступно");
      return;
    }
    // Avoid render-phase interference with dev hot-reload internals.
    window.setTimeout(() => setHierarchyExpanded(nextMode === "expand"), 0);
    window.setTimeout(() => {
      syncPivotSnapshot();
      hideInternalToolbar();
    }, 40);
  }, [hierarchyExpanded, hideInternalToolbar, syncPivotSnapshot]);

  useEffect(() => {
    const host = pivotWrapRef.current;
    if (!host) return;

    const localizeInternalUi = () => {
      localizeWdrTextNodes(host, captionMapRef.current);
      const inputs = host.querySelectorAll<HTMLInputElement>("input[placeholder], input[aria-label]");
      inputs.forEach((el) => {
        const ph = el.getAttribute("placeholder");
        if (ph) {
          const localized = localizeWdrTextValue(ph, captionMapRef.current);
          if (localized !== ph) el.setAttribute("placeholder", localized);
        }
        const aria = el.getAttribute("aria-label");
        if (aria) {
          const localized = localizeWdrTextValue(aria, captionMapRef.current);
          if (localized !== aria) el.setAttribute("aria-label", localized);
        }
      });
    };

    let pass = 0;
    const maxPasses = 40;
    const timer = window.setInterval(() => {
      hideInternalToolbar();
      localizeInternalUi();
      pass += 1;
      if (pass >= maxPasses) window.clearInterval(timer);
    }, 250);

    const observer = new MutationObserver(() => {
      hideInternalToolbar();
      localizeInternalUi();
    });
    observer.observe(host, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [hideInternalToolbar, pivotMountKey, pivotViewportPx]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!formatMenuRef.current) return;
      if (formatMenuRef.current.contains(ev.target as Node)) return;
      setFormatMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const loadSaved = useCallback(
    async (id: number) => {
      const row = savedQ.data?.find((x) => x.id === id);
      if (!row?.config) return;
      const cfg = row.config;
      if (isWdrSavedConfig(cfg)) {
        const emb = cfg.savdoDatasetFilters;
        const restored = emb ? normalizeSavedDatasetFilters(emb) : null;
        if (restored) setFilters(restored);
        const d = await datasetMut.mutateAsync(restored ?? filters);
        captionMapRef.current = buildCaptionMap(d.fields);
        const mapping = buildWdrMapping(d.fields);
        const merged: WdrReportJson = {
          ...cfg,
          dataSource: {
            dataSourceType: "json",
            data: d.rows as object[],
            ...(Object.keys(mapping).length ? { mapping } : {})
          }
        };
        requestAnimationFrame(() => {
          const api = getPivotApi(pivotRef);
          api?.setReport(merged as never);
          scheduleWdrLayoutRefresh(api ?? null);
        });
        setLastDataset(d);
        setActiveSavedReportId(id);
      } else {
        const legacy = cfg as LegacyConfigPayload;
        const fromLegacy =
          normalizeSavedDatasetFilters(legacy) ??
          ({
            ...defaultFilters(),
            dateMode: legacy.dateMode,
            dateFrom: legacy.dateFrom,
            dateTo: legacy.dateTo,
            agentIds: legacy.agentIds ?? [],
            statuses: legacy.statuses ?? [],
            orderTypes: legacy.orderTypes ?? []
          } satisfies FilterState);
        setFilters(fromLegacy);
        const migrated = migrateLegacyReportBuilderConfigToWdrReport(legacy);
        const d = await datasetMut.mutateAsync(fromLegacy);
        captionMapRef.current = buildCaptionMap(d.fields);
        applyDatasetToPivot(d.rows, migrated, d.fields);
        setActiveSavedReportId(id);
      }
    },
    [applyDatasetToPivot, datasetMut, filters, savedQ.data]
  );

  const initialReport = useMemo(() => {
    const base = emptyWdrReport();
    const seed = wdrSeedRowFromMetadata(metaQ.data);
    const dims =
      metaQ.data?.fields?.map((f) => ({ uniqueName: f.id, caption: f.label, type: "string" })) ?? [];
    const measures: Array<{ uniqueName: string; caption: string; type: string }> = [
      { uniqueName: "amount", caption: "Сумма", type: "number" },
      { uniqueName: "qty", caption: "Количество", type: "number" },
      { uniqueName: "volume", caption: "Объём", type: "number" },
      { uniqueName: "price", caption: "Цена", type: "number" },
      { uniqueName: "bonus_line_total", caption: "Бонус (строка)", type: "number" },
      { uniqueName: "order_bonus_sum", caption: "Бонусы (заказ)", type: "number" },
      { uniqueName: "discount_sum", caption: "Скидка", type: "number" },
      { uniqueName: "client_balance", caption: "Баланс", type: "number" },
      { uniqueName: "order_debt", caption: "Долг", type: "number" },
      { uniqueName: "product_weight_kg", caption: "Вес товара", type: "number" },
      { uniqueName: "retail_stock_qty", caption: "Остаток в ТТ (кол-во)", type: "number" },
      { uniqueName: "retail_stock_sold_qty", caption: "Продажа в ТТ (кол-во)", type: "number" },
      { uniqueName: "retail_stock_amount", caption: "Сумма в ТТ", type: "number" },
      { uniqueName: "client_id", caption: "АКБ", type: "number" }
    ];
    const allDefs = [...dims, ...measures];
    const mapping = buildWdrMapping(allDefs);
    captionMapRef.current = buildCaptionMap(allDefs);
    return {
      ...base,
      dataSource: {
        dataSourceType: "json",
        data: [seed] as object[],
        ...(Object.keys(mapping).length ? { mapping } : {})
      }
    };
  }, [metaQ.data]);

  const territoryFallback = useMemo(() => {
    const refs = (profileQ.data?.references ?? {}) as Record<string, unknown>;
    return territoryFromNodes(parseTerritoryNodeList(refs.territory_nodes));
  }, [profileQ.data?.references]);
  const territory1Items = useMemo(() => {
    const base = filtersQ.data?.territory_level_1 ?? [];
    const list = base.length > 0 ? base.map((t) => t.id) : territoryFallback.territory1;
    return list.map((id) => ({ id, title: id }));
  }, [filtersQ.data?.territory_level_1, territoryFallback.territory1]);
  const territory2Items = useMemo(() => {
    const base = filtersQ.data?.territory_level_2 ?? [];
    const all = base.length > 0 ? base : territoryFallback.territory2.map((id) => ({ id, label: id }));
    const map = (filtersQ.data?.territory_2_by_1 ?? territoryFallback.territory2By1) as Record<string, string[]>;
    if (filters.territoryLevel1Values.length === 0) return all.map((t) => ({ id: t.id, title: t.label }));
    const allowed = new Set<string>();
    for (const zone of filters.territoryLevel1Values) {
      for (const oblast of map[zone] ?? []) allowed.add(oblast);
    }
    const scoped = all.filter((t) => allowed.has(t.id));
    return (scoped.length > 0 ? scoped : all).map((t) => ({ id: t.id, title: t.label }));
  }, [
    filtersQ.data?.territory_level_2,
    filtersQ.data?.territory_2_by_1,
    territoryFallback.territory2,
    territoryFallback.territory2By1,
    filters.territoryLevel1Values
  ]);
  const territory3Items = useMemo(() => {
    const base = filtersQ.data?.territory_level_3 ?? [];
    const all = base.length > 0 ? base : territoryFallback.territory3.map((id) => ({ id, label: id }));
    const map = (filtersQ.data?.territory_3_by_2 ?? territoryFallback.territory3By2) as Record<string, string[]>;
    if (filters.territoryLevel2Values.length === 0) return all.map((t) => ({ id: t.id, title: t.label }));
    const allowed = new Set<string>();
    for (const oblast of filters.territoryLevel2Values) {
      for (const city of map[oblast] ?? []) allowed.add(city);
    }
    const scoped = all.filter((t) => allowed.has(t.id));
    return (scoped.length > 0 ? scoped : all).map((t) => ({ id: t.id, title: t.label }));
  }, [
    filtersQ.data?.territory_level_3,
    filtersQ.data?.territory_3_by_2,
    territoryFallback.territory3,
    territoryFallback.territory3By2,
    filters.territoryLevel2Values
  ]);
  const agentItems = useMemo(() => {
    const selectedSupervisors = new Set(filters.supervisorUserIds);
    const selectedTradeDirections = new Set(filters.tradeDirectionIds);
    const selectedBranches = new Set(filters.branchValues);
    return (filtersQ.data?.agents ?? [])
      .filter((a) => {
        if (selectedSupervisors.size > 0 && (a.supervisor_user_id == null || !selectedSupervisors.has(a.supervisor_user_id))) {
          return false;
        }
        if (selectedTradeDirections.size > 0 && (a.trade_direction_id == null || !selectedTradeDirections.has(a.trade_direction_id))) {
          return false;
        }
        if (selectedBranches.size > 0 && (!a.branch || !selectedBranches.has(a.branch))) {
          return false;
        }
        return true;
      })
      .map((a) => ({ id: String(a.id), title: a.code ? `${a.code} — ${a.name}` : a.name }));
  }, [filtersQ.data?.agents, filters.supervisorUserIds, filters.tradeDirectionIds, filters.branchValues]);
  const warehouseItems = useMemo(
    () => (filtersQ.data?.warehouses ?? []).map((w) => ({ id: String(w.id), title: w.code ? `${w.code} — ${w.name}` : w.name })),
    [filtersQ.data?.warehouses]
  );
  const productItems = useMemo(() => {
    const selectedCategories = new Set(filters.categoryIds);
    const selectedGroups = new Set(filters.productGroupIds);
    const selectedBrands = new Set(filters.brandIds);
    return (filtersQ.data?.products ?? [])
      .filter((p) => {
        if (selectedCategories.size > 0 && (p.category_id == null || !selectedCategories.has(p.category_id))) return false;
        if (selectedGroups.size > 0 && (p.product_group_id == null || !selectedGroups.has(p.product_group_id))) return false;
        if (selectedBrands.size > 0 && (p.brand_id == null || !selectedBrands.has(p.brand_id))) return false;
        return true;
      })
      .map((p) => ({ id: String(p.id), title: `${p.sku} — ${p.name}` }));
  }, [filtersQ.data?.products, filters.categoryIds, filters.productGroupIds, filters.brandIds]);
  const productCategoryItems = useMemo(
    () => (filtersQ.data?.product_categories ?? []).map((c) => ({ id: String(c.id), title: c.name })),
    [filtersQ.data?.product_categories]
  );
  const productGroupItems = useMemo(
    () => (filtersQ.data?.product_groups ?? []).map((g) => ({ id: String(g.id), title: g.code ? `${g.code} — ${g.name}` : g.name })),
    [filtersQ.data?.product_groups]
  );
  const brandItems = useMemo(
    () => (filtersQ.data?.brands ?? []).map((b) => ({ id: String(b.id), title: b.code ? `${b.code} — ${b.name}` : b.name })),
    [filtersQ.data?.brands]
  );
  const expeditorItems = useMemo(
    () => (filtersQ.data?.expeditors ?? []).map((u) => ({ id: String(u.id), title: u.code ? `${u.code} — ${u.name}` : u.name })),
    [filtersQ.data?.expeditors]
  );
  const supervisorItems = useMemo(
    () => (filtersQ.data?.supervisors ?? []).map((u) => ({ id: String(u.id), title: u.code ? `${u.code} — ${u.name}` : u.name })),
    [filtersQ.data?.supervisors]
  );
  const tradeDirectionItems = useMemo(
    () =>
      (filtersQ.data?.trade_directions ?? []).map((t) => ({
        id: String(t.id),
        title: t.code ? `${t.code} — ${t.name}` : t.name
      })),
    [filtersQ.data?.trade_directions]
  );
  const kpiGroupItems = useMemo(
    () => (filtersQ.data?.kpi_groups ?? []).map((g) => ({ id: String(g.id), title: g.code ? `${g.code} — ${g.name}` : g.name })),
    [filtersQ.data?.kpi_groups]
  );
  const clientItems = useMemo(
    () => (filtersQ.data?.clients ?? []).map((c) => ({ id: String(c.id), title: c.code ? `${c.code} — ${c.name}` : c.name })),
    [filtersQ.data?.clients]
  );
  const paymentMethodItems = useMemo(
    () => (filtersQ.data?.payment_methods ?? []).map((p) => ({ id: p.id, title: p.label })),
    [filtersQ.data?.payment_methods]
  );
  const priceTypeItems = useMemo(
    () => (filtersQ.data?.price_types ?? []).map((p) => ({ id: p.id, title: p.label })),
    [filtersQ.data?.price_types]
  );
  const branchItems = useMemo(
    () => (filtersQ.data?.branches ?? []).map((b) => ({ id: b.id, title: b.label })),
    [filtersQ.data?.branches]
  );
  const clientCategoryItems = useMemo(
    () => (filtersQ.data?.client_categories ?? []).map((c) => ({ id: c.id, title: c.label })),
    [filtersQ.data?.client_categories]
  );
  useEffect(() => {
    const allowed = new Set(agentItems.map((x) => Number.parseInt(String(x.id), 10)).filter((n) => n > 0));
    if (allowed.size === 0) return;
    setFilters((prev) => {
      const nextAgentIds = prev.agentIds.filter((id) => allowed.has(id));
      return nextAgentIds.length === prev.agentIds.length ? prev : { ...prev, agentIds: nextAgentIds };
    });
  }, [agentItems]);
  useEffect(() => {
    const allowed = new Set(productItems.map((x) => Number.parseInt(String(x.id), 10)).filter((n) => n > 0));
    if (allowed.size === 0) return;
    setFilters((prev) => {
      const nextProductIds = prev.productIds.filter((id) => allowed.has(id));
      return nextProductIds.length === prev.productIds.length ? prev : { ...prev, productIds: nextProductIds };
    });
  }, [productItems]);
  const dateModeItems = useMemo(
    () =>
      (metaQ.data?.dateModes ?? [
        { id: "order_date" as const, label: "Дата заказа" },
        { id: "shipped_date" as const, label: "Дата отправки" },
        { id: "created_date" as const, label: "Дата создания" }
      ]).filter((dm) => dm.id !== "delivered_date"),
    [metaQ.data?.dateModes]
  );

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(filters.dateFrom, filters.dateTo);

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden pb-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Конструктор отчетов</h1>
          <p className="text-xs text-muted-foreground">
            WebDataRocks — фильтры, сводная таблица, поля, slice, экспорт в Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/builder/pivot"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs text-muted-foreground")}
          >
            Virtual Pivot (основной)
          </Link>
        </div>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onApply={({ dateFrom, dateTo }) => setFilters((f) => ({ ...f, dateFrom, dateTo }))}
      />

      <WdrReportBuilderFiltersPanel
        filters={filters}
        setFilters={setFilters}
        filtersCollapsed={filtersCollapsed}
        setFiltersCollapsed={setFiltersCollapsed}
        dateAnchorRef={dateAnchorRef}
        dateOpen={dateOpen}
        setDateOpen={setDateOpen}
        onResetFilters={() => setFilters(defaultFilters())}
        dateModeItems={dateModeItems}
        periodBtn={periodBtn}
        loadData={loadData}
        datasetMutPending={datasetMut.isPending}
        agentItems={agentItems}
        productCategoryItems={productCategoryItems}
        productGroupItems={productGroupItems}
        productItems={productItems}
        branchItems={branchItems}
        filtersQ={filtersQ}
        warehouseItems={warehouseItems}
        expeditorItems={expeditorItems}
        brandItems={brandItems}
        clientCategoryItems={clientCategoryItems}
        priceTypeItems={priceTypeItems}
        paymentMethodItems={paymentMethodItems}
        supervisorItems={supervisorItems}
        tradeDirectionItems={tradeDirectionItems}
        kpiGroupItems={kpiGroupItems}
        clientItems={clientItems}
        territory1Items={territory1Items}
        territory2Items={territory2Items}
        territory3Items={territory3Items}
      />

      <WdrReportBuilderPivotSection
        lastDataset={lastDataset}
        pivotRef={pivotRef}
        pivotWrapRef={pivotWrapRef}
        formatMenuRef={formatMenuRef}
        pivotViewportPx={pivotViewportPx}
        hierarchyExpanded={hierarchyExpanded}
        formatMenuOpen={formatMenuOpen}
        setFormatMenuOpen={setFormatMenuOpen}
        formatCellsDialogOpen={formatCellsDialogOpen}
        setFormatCellsDialogOpen={setFormatCellsDialogOpen}
        conditionalDialogOpen={conditionalDialogOpen}
        setConditionalDialogOpen={setConditionalDialogOpen}
        saveDialogOpen={saveDialogOpen}
        setSaveDialogOpen={setSaveDialogOpen}
        savedReportsDialogOpen={savedReportsDialogOpen}
        setSavedReportsDialogOpen={setSavedReportsDialogOpen}
        activeSavedReportId={activeSavedReportId}
        cellFormatPattern={cellFormatPattern}
        setCellFormatPattern={setCellFormatPattern}
        conditionalRules={conditionalRules}
        setConditionalRules={setConditionalRules}
        formatValueScope={formatValueScope}
        setFormatValueScope={setFormatValueScope}
        formatAlign={formatAlign}
        setFormatAlign={setFormatAlign}
        formatThousands={formatThousands}
        setFormatThousands={setFormatThousands}
        formatDecimalSep={formatDecimalSep}
        setFormatDecimalSep={setFormatDecimalSep}
        formatDecimalPlaces={formatDecimalPlaces}
        setFormatDecimalPlaces={setFormatDecimalPlaces}
        formatNegatives={formatNegatives}
        setFormatNegatives={setFormatNegatives}
        formatNullValue={formatNullValue}
        setFormatNullValue={setFormatNullValue}
        formatAsPercent={formatAsPercent}
        setFormatAsPercent={setFormatAsPercent}
        saveName={saveName}
        setSaveName={setSaveName}
        saveMutPending={saveMut.isPending}
        savedQ={savedQ}
        lastWdrReportRef={lastWdrReportRef}
        pivotReadyRef={pivotReadyRef}
        onSave={onSave}
        onBrowserExport={onBrowserExport}
        onToggleHierarchy={onToggleHierarchy}
        runToolbarAction={runToolbarAction}
        onToggleFullscreen={onToggleFullscreen}
        loadDefaultReport={loadDefaultReport}
        loadSaved={loadSaved}
        pivotMountKey={pivotMountKey}
        beforeToolbarCreated={beforeToolbarCreated}
        initialReport={initialReport}
        syncPivotSnapshot={syncPivotSnapshot}
        hideInternalToolbar={hideInternalToolbar}
      />
    </div>
  );
}
