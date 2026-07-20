import * as WebDataRocksReact from "@webdatarocks/react-webdatarocks";
import { getUserFacingError } from "@/lib/error-utils";
import {
  emptyReportBuilderExtraFilters,
  type DatasetFiltersPayload,
  type LegacyConfigPayload,
  type WdrReportJson
} from "@/lib/report-builder-wdr-migrate";

export const DATASET_ID = "orders_sales_lines" as const;

export type DateMode = "order_date" | "shipped_date" | "delivered_date" | "created_date";

export type FilterState = DatasetFiltersPayload;

export type Metadata = {
  datasets: Array<{ id: string; label: string }>;
  dateModes: Array<{ id: DateMode; label: string }>;
  fields: Array<{ id: string; label: string; allowRow: boolean; allowCol: boolean }>;
  metrics: Array<{ id: string; label: string }>;
};

export type FilterOpts = {
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
export type TerritoryNode = { name?: string; active?: boolean; children?: TerritoryNode[] };

export type DatasetApiRow = Record<string, unknown>;

export type DatasetResponse = {
  fields: Array<{ uniqueName: string; caption: string; type: string }>;
  rows: DatasetApiRow[];
  truncated: boolean;
  totalRowCount: number;
  cap: number;
};

export type DatasetFieldMeta = DatasetResponse["fields"][number];

export function defaultRange() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0, 0, 0, 0, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export function defaultFilters(): FilterState {
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

export const DATASET_MEASURE_KEYS = [
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

export function wdrSeedRowFromMetadata(meta: Metadata | undefined): DatasetApiRow {
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

export function buildWdrMapping(fields: Array<{ uniqueName: string; caption: string; type?: string }>): Record<string, unknown> {
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

export function buildCaptionMap(fields: Array<{ uniqueName: string; caption: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const key = String(f.uniqueName ?? "").trim();
    const val = String(f.caption ?? "").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export function parseTerritoryNodeList(v: unknown): TerritoryNode[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    .map((x) => ({
      name: typeof x.name === "string" ? x.name : undefined,
      active: typeof x.active === "boolean" ? x.active : undefined,
      children: parseTerritoryNodeList(x.children)
    }));
}

export function territoryFromNodes(nodes: TerritoryNode[]) {
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

export function emptyWdrReport(): WdrReportJson {
  return {
    dataSource: { dataSourceType: "json", data: [] },
    slice: {
      measures: [{ uniqueName: "amount", aggregation: "sum" }]
    }
  };
}

export type PivotClass = InstanceType<typeof WebDataRocksReact.Pivot>;

export type WdrPivotApi = {
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

export function scheduleWdrLayoutRefresh(wdr: WdrPivotApi | null): void {
  if (!wdr || typeof wdr.refresh !== "function") return;
  requestAnimationFrame(() => {
    try {
      wdr.refresh!();
    } catch {
      /* noop */
    }
  });
}

export function getPivotApi(ref: React.RefObject<PivotClass | null>): WdrPivotApi | null {
  const inst = ref.current;
  if (!inst || !("webdatarocks" in inst)) return null;
  return (inst as PivotClass & { webdatarocks: WdrPivotApi }).webdatarocks;
}

export type WdrToolbarTab = { id?: string; [key: string]: unknown };
export type WdrToolbarLike = {
  getTabs?: () => WdrToolbarTab[];
  showOptionsDialog?: () => void;
  openFieldsList?: () => void;
  showFormattingDialog?: () => void;
};

export type WdrToolbarActions = {
  fields?: () => void;
  options?: () => void;
  format?: () => void;
};

export type ConditionalRule = {
  id: string;
  scope: "all";
  operator: "gt" | "lt" | "eq";
  threshold: string;
  fontName: string;
  fontSize: string;
  color: string;
};

export function tabTitle(t: WdrToolbarTab): string {
  return (typeof t.title === "string" ? t.title : "").trim().toLowerCase();
}

export function createWdrToolbarConfigurer(
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

export function clickHiddenNativeToolbarAction(host: HTMLElement, kind: "format" | "options" | "fields"): boolean {
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

export function clickWdrToolbarTabByKind(host: HTMLElement, kind: "format" | "options" | "fields"): boolean {
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

export function triggerSyntheticClick(target: HTMLElement): void {
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

export function clickWdrMenuItemByLabels(_host: HTMLElement, labels: string[]): boolean {
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

export function setNativeToolbarTemporaryVisibility(host: HTMLElement, visible: boolean): void {
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

export function logWdrPopupDiagnostics(): void {
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

export function closeOpenWdrPopups(host: HTMLElement): void {
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

export function hasVisibleWdrPopup(host: HTMLElement): boolean {
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

export function runWdrExpandCollapseAll(wdr: WdrPivotApi, mode: "expand" | "collapse"): boolean {
  // WebDataRocks documents these as table-hierarchy actions, unrelated to the
  // browser Fullscreen API. Keep the method call attached to `wdr`: its methods
  // use the pivot instance as `this` in some WDR builds.
  const documentedAction = mode === "expand" ? wdr.expandAllData : wdr.collapseAllData;
  if (typeof documentedAction === "function") {
    try {
      documentedAction.call(wdr);
      console.debug("[WDR][TREE] hierarchy action invoked", { mode, api: `${mode}AllData` });
      return true;
    } catch {
      // Older bundled WDR builds may expose the equivalent short method below.
    }
  }

  const fallbackAction = mode === "expand" ? wdr.expandAll : wdr.collapseAll;
  if (typeof fallbackAction !== "function") return false;
  try {
    fallbackAction.call(wdr);
    console.debug("[WDR][TREE] hierarchy fallback invoked", { mode, api: `${mode}All` });
    return true;
  } catch {
    return false;
  }
}

export function parseLooseNumber(raw: string): number | null {
  const compact = raw.replace(/\s+/g, "").replace(/,/g, ".").replace(/[^\d.+-]/g, "");
  if (!compact) return null;
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : null;
}

export function ruleMatches(rule: ConditionalRule, value: number): boolean {
  const threshold = Number.parseFloat(rule.threshold);
  if (!Number.isFinite(threshold)) return false;
  if (rule.operator === "gt") return value > threshold;
  if (rule.operator === "lt") return value < threshold;
  return value === threshold;
}

export function applyConditionalFormattingToHost(host: HTMLElement, rules: ConditionalRule[]): void {
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

export const WDR_RU_TEXT_MAP: Record<string, string> = {
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

export function localizeWdrTextValue(input: string, captionMap: Record<string, string>): string {
  const trimmed = input.trim();
  if (!trimmed) return input;
  if (captionMap[trimmed]) return captionMap[trimmed];
  if (WDR_RU_TEXT_MAP[trimmed]) return WDR_RU_TEXT_MAP[trimmed];
  return input;
}

export function localizeWdrTextNodes(host: HTMLElement, captionMap: Record<string, string>): void {
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
export function tryGetWdrReportJson(wdr: WdrPivotApi): WdrReportJson | null {
  try {
    const report = wdr.getReport();
    const plain = (typeof report === "string" ? JSON.parse(report as string) : report) as WdrReportJson;
    return plain && typeof plain === "object" ? plain : null;
  } catch {
    return null;
  }
}

export function axiosErrorFields(data: unknown): { error?: string; message?: string } {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const o = data as Record<string, unknown>;
  return {
    error: typeof o.error === "string" ? o.error : undefined,
    message: typeof o.message === "string" ? o.message : undefined
  };
}

/** Fastify «Route … not found» даёт `error: "Not Found"` — это не TenantNotFound. */
export function reportBuilderDatasetFailureMessage(err: unknown): string {
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
