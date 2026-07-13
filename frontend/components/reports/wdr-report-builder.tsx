"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Jadval ichki scroll uchun aniq balandlik; sahifa cheksiz cho‘zilmasin. */
import { useReportBuilderPivotHeight } from "./wdr/use-report-builder-pivot-height";
import * as WebDataRocksReact from "@webdatarocks/react-webdatarocks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  Filter,
  FolderOpen,
  Fullscreen,
  ListFilter,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Settings2,
  SlidersHorizontal
} from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import {
  emptyReportBuilderExtraFilters,
  isWdrSavedConfig,
  migrateLegacyReportBuilderConfigToWdrReport,
  normalizeSavedDatasetFilters,
  type DatasetFiltersPayload,
  type LegacyConfigPayload,
  type WdrReportJson
} from "@/lib/report-builder-wdr-migrate";

const DATASET_ID = "orders_sales_lines" as const;

type DateMode = "order_date" | "shipped_date" | "delivered_date" | "created_date";

type FilterState = DatasetFiltersPayload;

type Metadata = {
  datasets: Array<{ id: string; label: string }>;
  dateModes: Array<{ id: DateMode; label: string }>;
  fields: Array<{ id: string; label: string; allowRow: boolean; allowCol: boolean }>;
  metrics: Array<{ id: string; label: string }>;
};

type FilterOpts = {
  agents: Array<{
    id: number;
    name: string;
    code: string | null;
    supervisor_user_id: number | null;
    trade_direction_id: number | null;
    branch: string | null;
  }>;
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
  warehouses: Array<{ id: number; name: string; code: string | null }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    category_id: number | null;
    product_group_id: number | null;
    brand_id: number | null;
  }>;
  product_categories: Array<{ id: number; name: string }>;
  product_groups: Array<{ id: number; name: string; code: string | null }>;
  brands: Array<{ id: number; name: string; code: string | null }>;
  expeditors: Array<{ id: number; name: string; code: string | null }>;
  supervisors: Array<{ id: number; name: string; code: string | null }>;
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  kpi_groups: Array<{ id: number; name: string; code: string | null }>;
  clients: Array<{ id: number; name: string; code: string | null }>;
  payment_methods: Array<{ id: string; label: string }>;
  price_types: Array<{ id: string; label: string }>;
  branches: Array<{ id: string; label: string }>;
  client_categories: Array<{ id: string; label: string }>;
  territory_level_1: Array<{ id: string; label: string }>;
  territory_level_2: Array<{ id: string; label: string }>;
  territory_level_3: Array<{ id: string; label: string }>;
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
};
type TerritoryNode = { name?: string; active?: boolean; children?: TerritoryNode[] };

type DatasetApiRow = Record<string, unknown>;

type DatasetResponse = {
  fields: Array<{ uniqueName: string; caption: string; type: string }>;
  rows: DatasetApiRow[];
  truncated: boolean;
  totalRowCount: number;
  cap: number;
};

type DatasetFieldMeta = DatasetResponse["fields"][number];

function defaultRange() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0, 0, 0, 0, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function defaultFilters(): FilterState {
  const r = defaultRange();
  return {
    datasetId: DATASET_ID,
    dateMode: "order_date",
    dateFrom: r.from,
    dateTo: r.to,
    agentIds: [],
    statuses: [],
    orderTypes: [],
    ...emptyReportBuilderExtraFilters()
  };
}

const DATASET_MEASURE_KEYS = [
  "amount",
  "qty",
  "volume",
  "price",
  "bonus_line_total",
  "order_bonus_sum",
  "discount_sum",
  "client_balance",
  "order_debt",
  "product_weight_kg",
  "retail_stock_qty",
  "retail_stock_sold_qty",
  "retail_stock_amount",
  "client_id"
] as const;

function wdrSeedRowFromMetadata(meta: Metadata | undefined): DatasetApiRow {
  const row: DatasetApiRow = {};
  if (meta?.fields?.length) {
    for (const f of meta.fields) {
      row[f.id] = "";
    }
  }
  for (const k of DATASET_MEASURE_KEYS) {
    row[k] = 0;
  }
  return row;
}

function buildWdrMapping(fields: Array<{ uniqueName: string; caption: string; type?: string }>): Record<string, unknown> {
  const mapping: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f?.uniqueName) continue;
    const caption = String(f.caption ?? "").trim();
    const type = String(f.type ?? "").trim();
    mapping[f.uniqueName] = {
      caption: caption || f.uniqueName,
      ...(type ? { type } : {})
    };
  }
  return mapping;
}

function buildCaptionMap(fields: Array<{ uniqueName: string; caption: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const key = String(f.uniqueName ?? "").trim();
    const val = String(f.caption ?? "").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function parseTerritoryNodeList(v: unknown): TerritoryNode[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    .map((x) => ({
      name: typeof x.name === "string" ? x.name : undefined,
      active: typeof x.active === "boolean" ? x.active : undefined,
      children: parseTerritoryNodeList(x.children)
    }));
}

function territoryFromNodes(nodes: TerritoryNode[]) {
  const t1 = new Set<string>();
  const t2 = new Set<string>();
  const t3 = new Set<string>();
  const t2By1 = new Map<string, Set<string>>();
  const t3By2 = new Map<string, Set<string>>();
  for (const zoneNode of nodes) {
    if (zoneNode.active === false) continue;
    const zone = String(zoneNode.name ?? "").trim();
    if (!zone) continue;
    t1.add(zone);
    const z2 = t2By1.get(zone) ?? new Set<string>();
    for (const regionNode of zoneNode.children ?? []) {
      if (regionNode.active === false) continue;
      const region = String(regionNode.name ?? "").trim();
      if (!region) continue;
      t2.add(region);
      z2.add(region);
      const r3 = t3By2.get(region) ?? new Set<string>();
      for (const cityNode of regionNode.children ?? []) {
        if (cityNode.active === false) continue;
        const city = String(cityNode.name ?? "").trim();
        if (!city) continue;
        t3.add(city);
        r3.add(city);
      }
      t3By2.set(region, r3);
    }
    t2By1.set(zone, z2);
  }
  return {
    territory1: Array.from(t1).sort((a, b) => a.localeCompare(b, "ru")),
    territory2: Array.from(t2).sort((a, b) => a.localeCompare(b, "ru")),
    territory3: Array.from(t3).sort((a, b) => a.localeCompare(b, "ru")),
    territory2By1: Object.fromEntries(
      Array.from(t2By1.entries()).map(([k, v]) => [k, Array.from(v)])
    ) as Record<string, string[]>,
    territory3By2: Object.fromEntries(
      Array.from(t3By2.entries()).map(([k, v]) => [k, Array.from(v)])
    ) as Record<string, string[]>
  };
}

function emptyWdrReport(): WdrReportJson {
  return {
    dataSource: { dataSourceType: "json", data: [] },
    slice: {
      measures: [{ uniqueName: "amount", aggregation: "sum" }]
    }
  };
}

type PivotClass = InstanceType<typeof WebDataRocksReact.Pivot>;

type WdrPivotApi = {
  getReport: () => unknown;
  setReport: (r: unknown) => void;
  refresh?: () => void;
  exportTo: (type: string, exportOptions?: unknown, callbackHandler?: unknown) => void;
  showOptionsDialog?: () => void;
  openFieldsList?: () => void;
  showFormattingDialog?: () => void;
  expandAllData?: (...args: unknown[]) => void;
  collapseAllData?: (...args: unknown[]) => void;
  expandAll?: (...args: unknown[]) => void;
  collapseAll?: (...args: unknown[]) => void;
};

function scheduleWdrLayoutRefresh(wdr: WdrPivotApi | null): void {
  if (!wdr || typeof wdr.refresh !== "function") return;
  requestAnimationFrame(() => {
    try {
      wdr.refresh!();
    } catch {
      /* noop */
    }
  });
}

function getPivotApi(ref: React.RefObject<PivotClass | null>): WdrPivotApi | null {
  const inst = ref.current;
  if (!inst || !("webdatarocks" in inst)) return null;
  return (inst as PivotClass & { webdatarocks: WdrPivotApi }).webdatarocks;
}

type WdrToolbarTab = { id?: string; [key: string]: unknown };
type WdrToolbarLike = {
  getTabs?: () => WdrToolbarTab[];
  showOptionsDialog?: () => void;
  openFieldsList?: () => void;
  showFormattingDialog?: () => void;
};

type WdrToolbarActions = {
  fields?: () => void;
  options?: () => void;
  format?: () => void;
};

type ConditionalRule = {
  id: string;
  scope: "all";
  operator: "gt" | "lt" | "eq";
  threshold: string;
  fontName: string;
  fontSize: string;
  color: string;
};

function tabTitle(t: WdrToolbarTab): string {
  return (typeof t.title === "string" ? t.title : "").trim().toLowerCase();
}

function createWdrToolbarConfigurer(
  actionsRef: React.MutableRefObject<WdrToolbarActions>,
  toolbarRef: React.MutableRefObject<WdrToolbarLike | null>
) {
  return (toolbar: WdrToolbarLike) => {
    toolbarRef.current = toolbar;
    if (!toolbar || typeof toolbar.getTabs !== "function") return;
    const orig = toolbar.getTabs.bind(toolbar);
    toolbar.getTabs = () => {
      const tabs = orig();
      if (!Array.isArray(tabs)) return tabs;
      // noop

      const byId = new Map(tabs.map((t) => [String(t?.id ?? ""), t]));
      const byOptions = tabs.find((t) => tabTitle(t).includes("options") || tabTitle(t).includes("опции"));
      const byFormat = tabs.find((t) => tabTitle(t).includes("format") || tabTitle(t).includes("формат"));
      const toHandler = (t?: WdrToolbarTab) =>
        t && typeof (t as { handler?: unknown }).handler === "function"
          ? (t as { handler: (this: unknown) => void }).handler
          : undefined;

      const optionsH = toHandler(byId.get("wdr-tab-options")) ?? toHandler(byOptions);
      const formatH = toHandler(byId.get("wdr-tab-format")) ?? toHandler(byFormat);

      // Prefer tab-bound handlers first (better native context), then toolbar methods.
      const optionsCtx = byId.get("wdr-tab-options") ?? byOptions ?? toolbar;
      const formatCtx = byId.get("wdr-tab-format") ?? byFormat ?? toolbar;
      // Fields handler is unstable in this WDR build when `openFieldsList` is missing.
      // Keep only the native method if available; otherwise use DOM-click path in runToolbarAction.
      actionsRef.current.fields = toolbar.openFieldsList ? () => toolbar.openFieldsList?.() : undefined;
      // Options tab handler is unstable in some builds (expects toolbar context).
      // Use native toolbar method first; use tab handler only as the last fallback.
      actionsRef.current.options = toolbar.showOptionsDialog
        ? () => toolbar.showOptionsDialog?.()
        : optionsH
          ? () => optionsH.call(optionsCtx)
          : undefined;
      actionsRef.current.format = formatH
        ? () => formatH.call(formatCtx)
        : toolbar.showFormattingDialog
          ? () => toolbar.showFormattingDialog?.()
          : undefined;

      // Internal fullscreen tab sometimes crashes in WDR; use custom fullscreen button instead.
      return tabs.filter((t) => t?.id !== "wdr-tab-fullscreen");
    };
  };
}

function clickHiddenNativeToolbarAction(host: HTMLElement, kind: "format" | "options" | "fields"): boolean {
  void host;
  const labels =
    kind === "options"
      ? ["Options", "Опции"]
      : kind === "fields"
        ? ["Fields", "Поля"]
        : ["Format", "Формат"];
  const nodes = document.querySelectorAll<HTMLElement>("a,button,span,div");
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const txt = (n.textContent ?? "").trim();
    if (!txt) continue;
    if (!labels.some((l) => txt === l || txt.includes(l))) continue;
    const cls = (n.className || "").toString().toLowerCase();
    const isWdrNode = cls.includes("wdr") || cls.includes("toolbar") || cls.includes("tab");
    if (!isWdrNode) continue;
    const target = (n.closest("a,button") as HTMLElement | null) ?? n;
    try {
      triggerSyntheticClick(target);
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

function clickWdrToolbarTabByKind(host: HTMLElement, kind: "format" | "options" | "fields"): boolean {
  void host;
  const idToken = kind === "format" ? "wdr-tab-format" : kind === "options" ? "wdr-tab-options" : "wdr-tab-fields";
  const query = [
    `[id*='${idToken}']`,
    `[data-id='${idToken}']`,
    `[class*='${idToken}']`,
    `[class*='wdr-tab-${kind}']`,
    `[class*='wdr-tab'][aria-label*='${kind}']`
  ].join(",");
  const nodes = document.querySelectorAll<HTMLElement>(query);
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const target = (node.closest("a,button,li,[role='tab']") as HTMLElement | null) ?? node;
    try {
      triggerSyntheticClick(target);
      console.debug("[WDR][DIAG] clickWdrToolbarTabByKind clicked", {
        kind,
        idToken,
        index: i,
        className: (target.className || "").toString().slice(0, 140)
      });
      return true;
    } catch {
      // noop
    }
  }
  console.debug("[WDR][DIAG] clickWdrToolbarTabByKind no-click", { kind, idToken, nodesCount: nodes.length });
  return false;
}

function triggerSyntheticClick(target: HTMLElement): void {
  const events = ["pointerdown", "mousedown", "mouseup", "click"] as const;
  for (const type of events) {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );
  }
}

function clickWdrMenuItemByLabels(_host: HTMLElement, labels: string[]): boolean {
  void _host;
  const nodes = document.querySelectorAll<HTMLElement>(
    "a,button,li,[role='menuitem'],[class*='wdr-menu'] a,[class*='wdr-menu'] li,[class*='wdr-popup'] a,[class*='wdr-popup'] li"
  );
  console.debug("[WDR][DIAG] menu scan start", { labels, nodesCount: nodes.length });
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const txt = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    // Skip large container chunks; only small actionable labels are valid.
    if (txt.length > 80) continue;
    const matched = labels.some((l) => {
      const ll = l.trim();
      if (txt === ll) return true;
      // Some items have short suffix like "..." in this WDR build.
      return txt.startsWith(ll) && txt.length <= ll.length + 3;
    });
    if (!matched) continue;
    const cls = (n.className || "").toString().toLowerCase();
    const isWdrNode = cls.includes("wdr") || cls.includes("toolbar") || cls.includes("tab") || cls.includes("menu");
    const inWdrTree = Boolean(n.closest("[class*='wdr']"));
    if (!isWdrNode && !inWdrTree) continue;
    const target = (n.closest("a,button,li,[role='menuitem']") as HTMLElement | null) ?? n;
    try {
      triggerSyntheticClick(target);
      console.debug("[WDR][DIAG] menu click matched", {
        labels,
        index: i,
        text: txt,
        className: (target.className || "").toString().slice(0, 120)
      });
      return true;
    } catch {
      // noop
    }
  }
  console.debug("[WDR][DIAG] menu click no-match", { labels });
  return false;
}

function setNativeToolbarTemporaryVisibility(host: HTMLElement, visible: boolean): void {
  void visible;
  host.classList.remove("wdr-toolbar-visible");
  const nodes: HTMLElement[] = [];
  const tb = host.querySelector<HTMLElement>("#wdr-toolbar");
  if (tb) nodes.push(tb);
  nodes.forEach((el) => {
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("min-height", "0", "important");
    el.style.setProperty("max-height", "0", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("padding", "0", "important");
    el.style.setProperty("border", "0", "important");
    el.style.setProperty("overflow", "hidden", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
  });
  const wrap = host.querySelector<HTMLElement>("#wdr-toolbar-wrapper");
  if (wrap) {
    // Sibling layout: wrapper must stay content-sized (see globals.css). Not height:100%.
    wrap.style.setProperty("height", "auto", "important");
    wrap.style.setProperty("min-height", "0", "important");
    wrap.style.removeProperty("display");
    wrap.style.removeProperty("flex-direction");
    wrap.style.removeProperty("max-height");
  }
}

function logWdrPopupDiagnostics(): void {
  const popupNodes = document.querySelectorAll<HTMLElement>(
    "[class*='wdr-popup'], [class*='wdrPopup'], [id*='wdr-popup'], [class*='wdr-dialog'], [class*='wdrDialog']"
  );
  const rows: Array<Record<string, string | number>> = [];
  for (let i = 0; i < popupNodes.length; i += 1) {
    const el = popupNodes[i];
    const cs = window.getComputedStyle(el);
    rows.push({
      idx: i,
      cls: (el.className || "").toString().slice(0, 120),
      disp: cs.display,
      vis: cs.visibility,
      op: cs.opacity,
      z: cs.zIndex,
      pe: cs.pointerEvents
    });
  }
  // Debug trace for popup visibility/routing issues in custom format controls.
  console.debug("[WDR][DIAG] popup diagnostics", { total: popupNodes.length, rows });
}

function closeOpenWdrPopups(host: HTMLElement): void {
  const closeLabels = ["ОТМЕНА", "Отмена", "CANCEL", "Cancel", "CLOSE", "Close", "✕", "×"];
  const buttons = host.querySelectorAll<HTMLElement>("button, a, span, div");
  let closed = 0;
  for (let i = 0; i < buttons.length; i += 1) {
    const el = buttons[i];
    const txt = (el.textContent ?? "").trim();
    if (!txt) continue;
    if (!closeLabels.some((x) => txt === x)) continue;
    const cls = (el.className || "").toString().toLowerCase();
    if (!cls.includes("wdr")) continue;
    const target = (el.closest("button,a") as HTMLElement | null) ?? el;
    try {
      target.click();
      closed += 1;
    } catch {
      // noop
    }
  }
  if (closed > 0) console.debug("[WDR] closed stale popups", { closed });
}

function hasVisibleWdrPopup(host: HTMLElement): boolean {
  const popupNodes = host.querySelectorAll<HTMLElement>(
    "[class*='wdr-popup'], [class*='wdrPopup'], [id*='wdr-popup'], [class*='wdr-dialog'], [class*='wdrDialog']"
  );
  for (let i = 0; i < popupNodes.length; i += 1) {
    const el = popupNodes[i];
    // Skip nodes inside the real tab strip only. Modals use class "wdr-toolbar-ui" which would
    // falsely match "[class*='wdr-toolbar']" and become invisible to this detector.
    if (el.closest("#wdr-toolbar")) continue;
    const cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 40) continue;
    return true;
  }
  return false;
}

function runWdrExpandCollapseAll(wdr: WdrPivotApi, mode: "expand" | "collapse"): boolean {
  const fnCandidates =
    mode === "expand" ? [wdr.expandAllData, wdr.expandAll] : [wdr.collapseAllData, wdr.collapseAll];
  const argCandidates: unknown[][] = [[], [true], [false], ["rows"], ["columns"], ["all"]];

  for (let i = 0; i < fnCandidates.length; i += 1) {
    const fn = fnCandidates[i];
    if (typeof fn !== "function") continue;
    for (let j = 0; j < argCandidates.length; j += 1) {
      const args = argCandidates[j];
      try {
        fn(...args);
        console.debug("[WDR][TREE] action invoked", { mode, fnIndex: i, args });
        return true;
      } catch {
        // try next signature
      }
    }
  }
  return false;
}

function parseLooseNumber(raw: string): number | null {
  const compact = raw.replace(/\s+/g, "").replace(/,/g, ".").replace(/[^\d.+-]/g, "");
  if (!compact) return null;
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : null;
}

function ruleMatches(rule: ConditionalRule, value: number): boolean {
  const threshold = Number.parseFloat(rule.threshold);
  if (!Number.isFinite(threshold)) return false;
  if (rule.operator === "gt") return value > threshold;
  if (rule.operator === "lt") return value < threshold;
  return value === threshold;
}

function applyConditionalFormattingToHost(host: HTMLElement, rules: ConditionalRule[]): void {
  const cells = host.querySelectorAll<HTMLElement>("td,[role='gridcell'],.wdr-cell,[class*='wdr-cell']");
  cells.forEach((cell) => {
    const text = (cell.textContent ?? "").trim();
    const n = parseLooseNumber(text);
    if (n == null) {
      if (cell.dataset.salecCfApplied === "1") {
        cell.style.removeProperty("color");
        cell.style.removeProperty("font-size");
        cell.style.removeProperty("font-family");
        cell.style.removeProperty("font-weight");
        cell.dataset.salecCfApplied = "0";
      }
      return;
    }
    const matched = rules.find((r) => ruleMatches(r, n));
    if (!matched) {
      if (cell.dataset.salecCfApplied === "1") {
        cell.style.removeProperty("color");
        cell.style.removeProperty("font-size");
        cell.style.removeProperty("font-family");
        cell.style.removeProperty("font-weight");
        cell.dataset.salecCfApplied = "0";
      }
      return;
    }
    cell.style.setProperty("color", matched.color, "important");
    cell.style.setProperty("font-size", matched.fontSize, "important");
    cell.style.setProperty("font-family", matched.fontName, "important");
    cell.style.setProperty("font-weight", "600", "important");
    cell.dataset.salecCfApplied = "1";
  });
}

const WDR_RU_TEXT_MAP: Record<string, string> = {
  "Fields": "Поля",
  "All Fields": "Все поля",
  "Report Filters": "Фильтры отчета",
  "Columns": "Колонки",
  "Rows": "Строки",
  "Values": "Значения",
  "Drop field here": "Перетащите поле сюда",
  "Layout options": "Параметры макета",
  "Grand totals": "Итоги",
  "Subtotals": "Промежуточные итоги",
  "Layout": "Макет",
  "Format cells": "Формат ячеек",
  "Formatting": "Форматирование",
  "Formatting Rules": "Правила форматирования",
  "Conditional formatting": "Условное форматирование",
  "Number format": "Формат числа",
  "Choose value": "Выбрать значение",
  "Choose values": "Выбрать значения",
  "Align text": "Выравнивание текста",
  "Thousands separator": "Разделитель тысяч",
  "Decimal separator": "Десятичный разделитель",
  "Decimal places": "Десятичные знаки",
  "Negative numbers format": "Формат отрицательных чисел",
  "Null values": "Нулевые значения",
  "Format as percentage": "Форматировать как проценты",
  "Symbol position": "Позиция символа",
  "Value": "Значение",
  "Select value": "Выбрать значение",
  "There are no active conditions.": "Нет активных условий.",
  "Add condition": "Добавить условие",
  "Selected value": "Выбранное значение",
  "by value": "по значению",
  "by condition": "по условию",
  "Show grand totals": "Показывать итоги",
  "Do not show grand totals": "Не показывать итоги",
  "Show for rows only": "Только для строк",
  "Show for columns only": "Только для столбцов",
  "Show subtotals": "Показывать промежуточные итоги",
  "Do not show subtotals": "Не показывать промежуточные итоги",
  "Show subtotal rows only": "Только промежуточные строки",
  "Show subtotal columns only": "Только промежуточные столбцы",
  "Compact form": "Компактная форма",
  "Classic form": "Классическая форма",
  "Flat form": "Плоская форма",
  "Report": "Отчёт",
  "Open": "Открыть",
  "Save": "Сохранить",
  "Save as": "Сохранить как",
  "Export": "Экспорт",
  "Format": "Формат",
  "Options": "Опции",
  "Flat": "Плоский",
  "Grid": "Таблица",
  "Chart": "График",
  "APPLY": "ПРИМЕНИТЬ",
  "Apply": "Применить",
  "CANCEL": "ОТМЕНА",
  "Cancel": "Отмена",
  "DELETE": "Удалить",
  "Delete": "Удалить",
  "Close": "Закрыть",
  "Search": "Поиск"
};

function localizeWdrTextValue(input: string, captionMap: Record<string, string>): string {
  const trimmed = input.trim();
  if (!trimmed) return input;
  if (captionMap[trimmed]) return captionMap[trimmed];
  if (WDR_RU_TEXT_MAP[trimmed]) return WDR_RU_TEXT_MAP[trimmed];
  return input;
}

function localizeWdrTextNodes(host: HTMLElement, captionMap: Record<string, string>): void {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === Node.TEXT_NODE) nodes.push(n as Text);
  }
  nodes.forEach((textNode) => {
    const original = textNode.nodeValue ?? "";
    const trimmed = original.trim();
    if (!trimmed) return;
    const localized = localizeWdrTextValue(trimmed, captionMap);
    if (localized === trimmed) return;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    textNode.nodeValue = `${leading}${localized}${trailing}`;
  });
}

/** `getReport()` throws if the engine is not fully initialized — use snapshot + ready gate. */
function tryGetWdrReportJson(wdr: WdrPivotApi): WdrReportJson | null {
  try {
    const report = wdr.getReport();
    const plain = (typeof report === "string" ? JSON.parse(report as string) : report) as WdrReportJson;
    return plain && typeof plain === "object" ? plain : null;
  } catch {
    return null;
  }
}

function axiosErrorFields(data: unknown): { error?: string; message?: string } {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const o = data as Record<string, unknown>;
  return {
    error: typeof o.error === "string" ? o.error : undefined,
    message: typeof o.message === "string" ? o.message : undefined
  };
}

/** Fastify «Route … not found» даёт `error: "Not Found"` — это не TenantNotFound. */
function reportBuilderDatasetFailureMessage(err: unknown): string {
  const ax = err as { response?: { status?: number; data?: unknown } };
  const status = ax.response?.status;
  const { error, message } = axiosErrorFields(ax.response?.data);
  if (status === 404 && error === "TenantNotFound") return "Тенант не найден (404).";
  if (status === 404 && error === "Not Found") {
    const routeHint = message?.includes("report-builder") && message?.includes("dataset");
    return routeHint
      ? "На этом API нет POST …/report-builder/dataset (часто: старый процесс на :18080 или другой API_INTERNAL_ORIGIN). Перезапустите backend из корня репозитория (npm run dev)."
      : "404 Not Found: проверьте, что Next проксирует на тот же backend, где есть маршрут dataset.";
  }
  if (status === 404) return "404: проверьте тенант и адрес API.";
  return getUserFacingError(err, "Ошибка загрузки данных");
}

export function WdrReportBuilder() {
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
          <h1 className="text-lg font-semibold">Универсальный отчет по продажам</h1>
          <p className="text-xs text-muted-foreground">Фильтры, сводная таблица, экспорт</p>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setFiltersCollapsed((v) => !v)}
          >
            {filtersCollapsed ? "Развернуть фильтры" : "Свернуть фильтры"}
          </Button>
        </CardHeader>
        {!filtersCollapsed ? <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Дата применяется по</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {dateModeItems.map((dm) => (
                  <label key={dm.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="wdr-rb-date-mode"
                      checked={filters.dateMode === dm.id}
                      onChange={() => setFilters((f) => ({ ...f, dateMode: dm.id }))}
                    />
                    {dm.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              ref={dateAnchorRef}
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 shrink-0 gap-2 font-normal",
                dateOpen && "border-primary/60 bg-primary/5"
              )}
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Период</span>
              <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 p-0"
                title="Сбросить фильтры"
                onClick={() => setFilters(defaultFilters())}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-[8.5rem] gap-1 bg-[#2D948A] text-white hover:bg-[#268a7f]"
                disabled={datasetMut.isPending}
                onClick={() =>
                  void loadData().catch((err: unknown) => {
                    window.alert(reportBuilderDatasetFailureMessage(err));
                  })
                }
              >
                {datasetMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Применить
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Агент"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Агент"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={agentItems}
                selected={new Set(filters.agentIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.agentIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    agentIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Агент"
                minPopoverWidth={220}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Категория продукта"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Категория"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productCategoryItems}
                selected={new Set(filters.categoryIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.categoryIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    categoryIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Категория"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Группа товаров"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Группа"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productGroupItems}
                selected={new Set(filters.productGroupIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.productGroupIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    productGroupIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Группа"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Продукт"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Продукт"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productItems}
                selected={new Set(filters.productIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.productIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    productIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Продукт"
                minPopoverWidth={240}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Филиалы"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Филиал"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={branchItems}
                selected={new Set(filters.branchValues)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.branchValues)) : next;
                  setFilters((f) => ({ ...f, branchValues: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Филиал"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Статус заказа"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Статус"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={(filtersQ.data?.statuses ?? []).map((s) => ({ id: s.id, title: s.label }))}
                selected={new Set(filters.statuses)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.statuses)) : next;
                  setFilters((f) => ({ ...f, statuses: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Статус"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Склад"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Склад"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={warehouseItems}
                selected={new Set(filters.warehouseIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.warehouseIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    warehouseIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Склад"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>

            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Экспедитор"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Экспедитор"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={expeditorItems}
                selected={new Set(filters.expeditorUserIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.expeditorUserIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    expeditorUserIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Экспедитор"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Бренд"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Бренд"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={brandItems}
                selected={new Set(filters.brandIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.brandIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    brandIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Бренд"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Категория клиента"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Категория клиента"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={clientCategoryItems}
                selected={new Set(filters.clientCategoryValues)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.clientCategoryValues)) : next;
                  setFilters((f) => ({ ...f, clientCategoryValues: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Категория клиента"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Тип цены"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Тип цены"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={priceTypeItems}
                selected={new Set(filters.priceTypeRefs)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.priceTypeRefs)) : next;
                  setFilters((f) => ({ ...f, priceTypeRefs: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Тип цены"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Способ оплаты"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Оплата"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={paymentMethodItems}
                selected={new Set(filters.paymentMethodRefs)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.paymentMethodRefs)) : next;
                  setFilters((f) => ({ ...f, paymentMethodRefs: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Оплата"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Тип заказа"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Тип заказа"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={(filtersQ.data?.order_types ?? []).map((s) => ({ id: s.id, title: s.label }))}
                selected={new Set(filters.orderTypes)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.orderTypes)) : next;
                  setFilters((f) => ({ ...f, orderTypes: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Тип"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Супервайзер"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Супервайзер"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={supervisorItems}
                selected={new Set(filters.supervisorUserIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.supervisorUserIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    supervisorUserIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Супервайзер"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>

            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Направление торговли"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Направление"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={tradeDirectionItems}
                selected={new Set(filters.tradeDirectionIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.tradeDirectionIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    tradeDirectionIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Направление"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Группа KPI"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="KPI"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={kpiGroupItems}
                selected={new Set(filters.kpiGroupIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.kpiGroupIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    kpiGroupIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="KPI"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Клиенты"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Клиент"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={clientItems}
                selected={new Set(filters.clientIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.clientIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    clientIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Клиент"
                minPopoverWidth={220}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Зона"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Зона"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory1Items}
                selected={new Set(filters.territoryLevel1Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel1Values)) : next;
                  // Hierarchy: when zone changes, oblast/gorod selections must reset.
                  setFilters((f) => ({
                    ...f,
                    territoryLevel1Values: Array.from(s),
                    territoryLevel2Values: [],
                    territoryLevel3Values: []
                  }));
                }}
                searchable
                searchPlaceholder="Зона"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Область"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Область"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory2Items}
                selected={new Set(filters.territoryLevel2Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel2Values)) : next;
                  // Hierarchy: when oblast changes, gorod selection must reset.
                  setFilters((f) => ({
                    ...f,
                    territoryLevel2Values: Array.from(s),
                    territoryLevel3Values: []
                  }));
                }}
                searchable
                searchPlaceholder="Область"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Город"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Город"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory3Items}
                selected={new Set(filters.territoryLevel3Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel3Values)) : next;
                  setFilters((f) => ({ ...f, territoryLevel3Values: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Город"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
          </div>
        </CardContent> : null}
      </Card>

      {lastDataset?.truncated ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Показано не более {lastDataset.cap.toLocaleString()} строк из {lastDataset.totalRowCount.toLocaleString()}. Сузьте
          фильтры или выгрузите текущую таблицу через «Экспорт» (Excel в браузере).
        </div>
      ) : null}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Сводная таблица</CardTitle>
          <p className="text-xs text-muted-foreground">
            Перетащите поля в строки / столбцы / значения. Фильтрация по значениям доступна в заголовках колонок.
          </p>
        </CardHeader>
        <CardContent className="min-h-0 pt-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => setSavedReportsDialogOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Отчёт
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setSaveDialogOpen(true)}>
                <Save className="h-3.5 w-3.5" />
                Сохр. как
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onBrowserExport}>
                <Download className="h-3.5 w-3.5" />
                Экспорт
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={onToggleHierarchy}
              >
                {hierarchyExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {hierarchyExpanded ? "Свернуть всё" : "Развернуть всё"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setFormatMenuOpen((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Формат
                </Button>
                {formatMenuOpen ? (
                  <div
                    ref={formatMenuRef}
                    className="absolute left-0 top-full z-30 -mt-px min-w-[12rem] rounded-b-md border border-border bg-popover p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setFormatMenuOpen(false);
                        setFormatCellsDialogOpen(true);
                      }}
                    >
                      <span className="text-muted-foreground">S/1.0</span>
                      Формат ячеек
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setFormatMenuOpen(false);
                        setConditionalDialogOpen(true);
                      }}
                    >
                      <span className="text-muted-foreground">123</span>
                      Условное форматирование
                    </button>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  if (!runToolbarAction("options")) window.alert("Панель «Опции» пока недоступна");
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Опции
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  if (!runToolbarAction("fields")) window.alert("Панель «Поля» пока недоступна");
                }}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Поля
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onToggleFullscreen}>
                <Fullscreen className="h-3.5 w-3.5" />
                На весь экран
              </Button>
            </div>
          </div>
          <div
            ref={pivotWrapRef}
            className="wdr-host w-full max-w-full min-h-0 overflow-x-auto rounded border border-border bg-background"
            style={{ height: pivotViewportPx }}
          >
            <WebDataRocksReact.Pivot
              key={pivotMountKey}
              ref={pivotRef}
              toolbar
              localization="https://cdn.webdatarocks.com/loc/ru.json"
              beforetoolbarcreated={beforeToolbarCreated}
              width="100%"
              height={pivotViewportPx}
              report={initialReport as never}
              ready={() => {
                pivotReadyRef.current = true;
                syncPivotSnapshot();
                hideInternalToolbar();
                scheduleWdrLayoutRefresh(getPivotApi(pivotRef));
              }}
              reportcomplete={() => {
                syncPivotSnapshot();
                hideInternalToolbar();
                scheduleWdrLayoutRefresh(getPivotApi(pivotRef));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сохранить отчёт</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Введите имя для текущей формы отчёта.</p>
            <Input
              className="h-9"
              placeholder="Например: Продажи по агентам"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saveMut.isPending || saveName.trim().length === 0}
              onClick={() => void onSave().then((ok) => ok && setSaveDialogOpen(false))}
            >
              {saveMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savedReportsDialogOpen} onOpenChange={setSavedReportsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Выберите отчёт для просмотра</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {(savedQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет сохранённых отчётов.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition-colors",
                    activeSavedReportId === null
                      ? "border-blue-300 bg-blue-600 text-white"
                      : "border-blue-200 bg-blue-500/90 text-white hover:bg-blue-600"
                  )}
                  onClick={() => {
                    void loadDefaultReport()
                      .then(() => setSavedReportsDialogOpen(false))
                      .catch((err: unknown) =>
                        window.alert(getUserFacingError(err, "Ошибка загрузки отчёта по умолчанию"))
                      );
                  }}
                >
                  По умолчанию
                </button>
                {(savedQ.data ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      activeSavedReportId === s.id
                        ? "border-blue-300 bg-blue-600 text-white"
                        : "border-blue-200 bg-blue-500/90 text-white hover:bg-blue-600"
                    )}
                    onClick={() => {
                      void loadSaved(s.id)
                        .then(() => setSavedReportsDialogOpen(false))
                        .catch((err: unknown) => window.alert(getUserFacingError(err, "Ошибка загрузки")));
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSavedReportsDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formatCellsDialogOpen} onOpenChange={setFormatCellsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Форматирование</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[160px_1fr] gap-2 text-xs">
            <label className="self-center text-foreground">Выбрать</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatValueScope} onChange={(e) => setFormatValueScope(e.target.value)}>
              <option value="selected">Выбрать значение</option>
              <option value="all">Все значения</option>
            </select>

            <label className="self-center text-foreground">Выравнивание текста</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatAlign} onChange={(e) => setFormatAlign(e.target.value)}>
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>

            <label className="self-center text-foreground">Thousands separator</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatThousands} onChange={(e) => setFormatThousands(e.target.value)}>
              <option value="space">(пробел)</option>
              <option value=",">,</option>
              <option value=".">.</option>
            </select>

            <label className="self-center text-foreground">Десятичный разделитель</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatDecimalSep} onChange={(e) => setFormatDecimalSep(e.target.value)}>
              <option value=".">.</option>
              <option value=",">,</option>
            </select>

            <label className="self-center text-foreground">Десятичные знаки</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatDecimalPlaces} onChange={(e) => setFormatDecimalPlaces(e.target.value)}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>

            <label className="self-center text-foreground">Negative number format</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatNegatives} onChange={(e) => setFormatNegatives(e.target.value)}>
              <option value="-1">-1</option>
              <option value="(1)">(1)</option>
            </select>

            <label className="self-center text-foreground">Нулевое значение</label>
            <Input className="h-8" value={formatNullValue} onChange={(e) => setFormatNullValue(e.target.value)} />

            <label className="self-center text-foreground">Форматировать как проценты</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatAsPercent} onChange={(e) => setFormatAsPercent(e.target.value)}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>

            <label className="self-center text-foreground">Шаблон числа</label>
            <Input className="h-8" value={cellFormatPattern} onChange={(e) => setCellFormatPattern(e.target.value)} placeholder="#,##0.00" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormatCellsDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                const wdr = getPivotApi(pivotRef);
                if (!wdr || !pivotReadyRef.current) {
                  window.alert("Таблица ещё не готова");
                  return;
                }
                const plain = tryGetWdrReportJson(wdr) ?? lastWdrReportRef.current;
                const next = {
                  ...plain,
                  savdoCustomFormat: {
                    ...((plain as Record<string, unknown>).savdoCustomFormat as Record<string, unknown>),
                    cellFormatPattern,
                    formatValueScope,
                    formatAlign,
                    formatThousands,
                    formatDecimalSep,
                    formatDecimalPlaces,
                    formatNegatives,
                    formatNullValue,
                    formatAsPercent
                  }
                } as WdrReportJson;
                lastWdrReportRef.current = next;
                wdr.setReport(next as never);
                scheduleWdrLayoutRefresh(wdr);
                setFormatCellsDialogOpen(false);
              }}
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conditionalDialogOpen} onOpenChange={setConditionalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Форматирование...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded border border-input px-2 py-1 text-foreground hover:bg-muted"
                onClick={() =>
                  setConditionalRules((prev) => [
                    ...prev,
                    {
                      id: `r-${Date.now()}-${prev.length}`,
                      scope: "all",
                      operator: "lt",
                      threshold: "0",
                      fontName: "Arial",
                      fontSize: "12px",
                      color: "#ef4444"
                    }
                  ])
                }
              >
                +
              </button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    const host = pivotWrapRef.current;
                    if (host) applyConditionalFormattingToHost(host, conditionalRules);
                  }}
                >
                  ПРИМЕНИТЬ
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setConditionalDialogOpen(false)}>ОТМЕНИТЬ</Button>
              </div>
            </div>
            {conditionalRules.length === 0 ? (
              <div className="rounded border border-input p-4 text-center text-muted-foreground">
                <p>There are no active conditions.</p>
                <button
                  type="button"
                  className="mt-3 rounded border border-input px-3 py-1 hover:bg-muted"
                  onClick={() =>
                    setConditionalRules([
                      {
                        id: `r-${Date.now()}`,
                        scope: "all",
                        operator: "lt",
                        threshold: "0",
                        fontName: "Arial",
                        fontSize: "12px",
                        color: "#ef4444"
                      }
                    ])
                  }
                >
                  + Add condition
                </button>
              </div>
            ) : (
              conditionalRules.map((rule) => (
                <div key={rule.id} className="space-y-2 rounded border border-input p-2">
                  <div className="grid grid-cols-[80px_1fr_1fr_1fr_24px] items-center gap-2">
                    <label className="text-foreground">Значение:</label>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.scope}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, scope: e.target.value as "all" } : x)))
                      }
                    >
                      <option value="all">Все значения</option>
                    </select>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.operator}
                      onChange={(e) =>
                        setConditionalRules((prev) =>
                          prev.map((x) => (x.id === rule.id ? { ...x, operator: e.target.value as "gt" | "lt" | "eq" } : x))
                        )
                      }
                    >
                      <option value="lt">Меньше чем</option>
                      <option value="gt">Больше чем</option>
                      <option value="eq">Равно</option>
                    </select>
                    <Input
                      className="h-8"
                      value={rule.threshold}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, threshold: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setConditionalRules((prev) => prev.filter((x) => x.id !== rule.id))}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_90px_36px_1fr] items-center gap-2">
                    <label className="text-foreground">Формат:</label>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.fontName}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, fontName: e.target.value } : x)))
                      }
                    >
                      <option value="Arial">Arial</option>
                      <option value="Inter">Inter</option>
                      <option value="Tahoma">Tahoma</option>
                    </select>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.fontSize}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, fontSize: e.target.value } : x)))
                      }
                    >
                      <option value="11px">11px</option>
                      <option value="12px">12px</option>
                      <option value="13px">13px</option>
                      <option value="14px">14px</option>
                    </select>
                    <div className="flex h-8 items-center justify-center rounded border border-input bg-muted text-foreground">A</div>
                    <Input
                      className="h-8"
                      value={rule.color}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, color: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConditionalDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                const wdr = getPivotApi(pivotRef);
                if (!wdr || !pivotReadyRef.current) {
                  window.alert("Таблица ещё не готова");
                  return;
                }
                const plain = tryGetWdrReportJson(wdr) ?? lastWdrReportRef.current;
                const next = {
                  ...plain,
                  savdoCustomFormat: {
                    ...(plain as Record<string, unknown>).savdoCustomFormat as Record<string, unknown>,
                    conditionalThreshold,
                    conditionalRules
                  }
                } as WdrReportJson;
                lastWdrReportRef.current = next;
                wdr.setReport(next as never);
                scheduleWdrLayoutRefresh(wdr);
                const hostEl = pivotWrapRef.current;
                if (hostEl) applyConditionalFormattingToHost(hostEl, conditionalRules);
                setConditionalDialogOpen(false);
              }}
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WdrReportBuilder;
