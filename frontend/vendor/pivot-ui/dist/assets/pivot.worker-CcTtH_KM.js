class Ne {
  aggregate(e, t) {
    if (e.length === 0)
      return null;
    switch (t) {
      case "SUM":
        return e.reduce((r, l) => r + l, 0);
      case "COUNT":
        return e.length;
      case "COUNT_DISTINCT":
        return new Set(e).size;
      case "AVG":
        return e.reduce((r, l) => r + l, 0) / e.length;
      case "MIN":
        return Math.min(...e);
      case "MAX":
        return Math.max(...e);
      case "PRODUCT":
        return e.reduce((r, l) => r * l, 1);
      case "PERCENT_OF_TOTAL":
      case "PERCENT_OF_ROW":
      case "PERCENT_OF_COLUMN":
      case "RUNNING_TOTAL":
      case "INDEX":
      case "DIFFERENCE":
        return e.reduce((r, l) => r + l, 0);
      case "CUSTOM":
        return e.reduce((r, l) => r + l, 0);
      default:
        return e.reduce((r, l) => r + l, 0);
    }
  }
  /** O'zbekiston uchun maxsus: NDS hisoblash */
  calculateVAT(e, t = 0.12) {
    return e * t;
  }
  /** Bonus hisoblash (SavdoDesk uchun) */
  calculateBonus(e, t, r) {
    return e >= t ? e * (r / 100) : 0;
  }
  /** Retrobonus — chegarali bonus */
  calculateRetrobonus(e, t) {
    const l = [...t].sort((o, s) => s.minVolume - o.minVolume).find((o) => e >= o.minVolume);
    return l ? e * (l.percent / 100) : 0;
  }
}
const M = " | ", K = "__all__";
function Re(n, e, t = {}) {
  const r = t.nullLabel ?? "N/A", l = /* @__PURE__ */ new Map();
  if (e.length === 0)
    return l.set(K, [...n]), l;
  for (const o of n) {
    const s = e.map((i) => String(o[i] ?? r)).join(M), a = l.get(s);
    a ? a.push(o) : l.set(s, [o]);
  }
  return l;
}
function S(n) {
  return n.split(M);
}
function $(n) {
  const e = S(n);
  return e[e.length - 1] ?? n;
}
const v = "__root__";
class P {
  constructor() {
    this.cube = /* @__PURE__ */ new Map();
  }
  build(e, t) {
    this.cube.clear(), this.ingestRows(e, t);
  }
  /** Mavjud cube ustiga yangi qatorlarni qo'shish (incremental update). */
  appendRows(e, t) {
    this.ingestRows(e, t);
  }
  ingestRows(e, t) {
    for (const r of e) {
      const l = this.makeColKey(r, t.columns), o = this.makeRowKeys(r, t.rows);
      for (const s of o)
        for (const a of t.values) {
          const i = this.asNumber(r[a.fieldId]);
          i != null && this.push(s, l, a.fieldId, i);
        }
      for (const s of t.values) {
        const a = this.asNumber(r[s.fieldId]);
        a != null && this.push(K, l, s.fieldId, a);
      }
    }
  }
  getValues(e, t, r) {
    var l, o;
    return ((o = (l = this.cube.get(e)) == null ? void 0 : l.get(t)) == null ? void 0 : o.get(r)) ?? [];
  }
  push(e, t, r, l) {
    let o = this.cube.get(e);
    o || (o = /* @__PURE__ */ new Map(), this.cube.set(e, o));
    let s = o.get(t);
    s || (s = /* @__PURE__ */ new Map(), o.set(t, s));
    const a = s.get(r);
    a ? a.push(l) : s.set(r, [l]);
  }
  makeRowKeys(e, t) {
    if (t.length === 0)
      return [K];
    const r = [];
    for (let l = 1; l <= t.length; l++)
      r.push(this.makeKey(e, t.slice(0, l)));
    return r;
  }
  makeColKey(e, t) {
    return t.length === 0 ? v : this.makeKey(e, t);
  }
  makeKey(e, t) {
    return t.map((r) => String(e[r] ?? "N/A")).join(M);
  }
  asNumber(e) {
    return typeof e == "number" && Number.isFinite(e) ? e : null;
  }
}
class ke {
  constructor() {
    this.cache = /* @__PURE__ */ new Map(), this.maxEntries = 8;
  }
  get(e, t) {
    return this.cache.get(`${e}|${t}`);
  }
  set(e) {
    const t = `${e.dataHash}|${e.configHash}`;
    if (this.cache.size >= this.maxEntries && !this.cache.has(t)) {
      const r = this.cache.keys().next().value;
      r && this.cache.delete(r);
    }
    this.cache.set(t, e);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
}
function x(n) {
  if (n.length === 0)
    return "empty";
  const e = n[0], t = n[n.length - 1];
  let r = n.length;
  const l = [e, t];
  for (const o of l)
    if (o)
      for (const s of Object.values(o))
        typeof s == "number" && Number.isFinite(s) && (r += s);
  return `${n.length}:${r}`;
}
function Se(n) {
  const e = {
    rows: n.rows,
    columns: n.columns,
    values: n.values,
    reportFilters: n.reportFilters,
    filters: n.filters,
    calculatedMeasures: n.calculatedMeasures ?? [],
    showSubtotals: n.options.showSubtotals,
    showGrandTotal: n.options.showGrandTotal,
    showColumnTotals: n.options.showColumnTotals,
    drillDown: n.options.drillDown,
    maxRows: n.options.maxRows,
    conditionalFormats: n.options.conditionalFormats
  };
  return JSON.stringify(e);
}
function ve(n) {
  return JSON.stringify(n);
}
function Ie(n, e) {
  return n.length === 0 || e.length <= n.length ? !1 : x(n) === x(e.slice(0, n.length));
}
class H {
  apply(e, t, r) {
    if (!t.length)
      return e;
    const l = t.filter((a) => a.type === "top_n" || a.type === "bottom_n"), o = t.filter((a) => a.type !== "top_n" && a.type !== "bottom_n");
    let s = e.filter((a) => o.every((i) => this.matchesFilter(a, i, r)));
    for (const a of l)
      s = this.applyRankFilter(s, a);
    return s;
  }
  applyRankFilter(e, t) {
    const r = t.topN;
    if (!r || r <= 0 || !e.length)
      return e;
    const l = /* @__PURE__ */ new Map();
    for (const a of e) {
      const i = a[t.fieldId];
      if (i == null)
        continue;
      const u = this.rankScore(a, t);
      l.set(i, (l.get(i) ?? 0) + u);
    }
    const o = [...l.entries()].sort((a, i) => t.type === "bottom_n" ? a[1] - i[1] : i[1] - a[1]), s = new Set(o.slice(0, r).map(([a]) => a));
    return e.filter((a) => {
      const i = a[t.fieldId];
      return i != null && s.has(i);
    });
  }
  rankScore(e, t) {
    if (t.measureFieldId) {
      const r = Number(e[t.measureFieldId]);
      return Number.isFinite(r) ? r : 0;
    }
    return 1;
  }
  matchesFilter(e, t, r) {
    var s, a;
    const l = e[t.fieldId], o = r.find((i) => i.id === t.fieldId);
    switch (t.type) {
      case "include":
        return ((s = t.values) == null ? void 0 : s.includes(l)) ?? !0;
      case "exclude":
        return !(((a = t.values) == null ? void 0 : a.includes(l)) ?? !1);
      case "range": {
        const i = Number(l);
        if (!Number.isFinite(i))
          return !1;
        const { min: u, max: c } = t.range ?? {};
        return !(u !== void 0 && i < u || c !== void 0 && i > c);
      }
      case "date_range": {
        const i = this.toDate(l, o);
        if (!i)
          return !1;
        const { from: u, to: c } = t.dateRange ?? {};
        return !(u && i < u || c && i > c);
      }
      case "top_n":
      case "bottom_n":
        return !0;
      default:
        return !0;
    }
  }
  toDate(e, t) {
    if (e instanceof Date)
      return e;
    if (typeof e == "string" || typeof e == "number") {
      const r = new Date(e);
      return Number.isNaN(r.getTime()) ? null : r;
    }
    if ((t == null ? void 0 : t.dataType) === "date" && e != null) {
      const r = new Date(String(e));
      return Number.isNaN(r.getTime()) ? null : r;
    }
    return null;
  }
}
class De {
  /**
   * Ma'lumotlarni berilgan maydonlar bo'yicha guruhlaydi.
   */
  groupData(e, t) {
    return Re(e, t);
  }
  /**
   * Ustun guruhlarini aniqlaydi.
   */
  getColumnGroups(e, t) {
    return this.groupData(e, t);
  }
  /**
   * Flat data → pivot uchun qulay format (sana maydonlarini yil/oy/chorak ga ajratish).
   */
  normalize(e, t) {
    return e.map((r) => {
      const l = { ...r };
      for (const o of t)
        if (r[o]) {
          const s = new Date(r[o]);
          Number.isNaN(s.getTime()) || (l[`${o}_year`] = s.getFullYear(), l[`${o}_month`] = s.getMonth() + 1, l[`${o}_quarter`] = Math.ceil((s.getMonth() + 1) / 3), l[`${o}_week`] = this.getWeekNumber(s));
        }
      return l;
    });
  }
  getWeekNumber(e) {
    const t = new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate())), r = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - r);
    const l = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t.getTime() - l.getTime()) / 864e5 + 1) / 7);
  }
}
class Ke {
  /** Qatorlarni `options.sortBy` bo'yicha tartiblaydi (rekursiv). */
  sortRows(e, t, r) {
    return !t || e.length <= 1 ? e.map((o) => this.sortRowChildren(o, t, r)) : [...e].sort((o, s) => this.compareRows(o, s, t, r)).map((o) => this.sortRowChildren(o, t, r));
  }
  /** Ustun spetsifikatsiyalarini tartiblaydi. */
  sortColSpecs(e, t, r) {
    if (!t || e.length <= 1)
      return e;
    const l = r.columns.indexOf(t.fieldId);
    return l >= 0 ? [...e].sort((s, a) => this.compareScalars(s.colParts[l] ?? "", a.colParts[l] ?? "", t.direction)) : r.values.findIndex((s) => s.fieldId === t.fieldId) >= 0 ? [...e].sort((s, a) => {
      const i = s.colParts[s.colParts.length - 1] ?? "", u = a.colParts[a.colParts.length - 1] ?? "";
      return this.compareScalars(i, u, t.direction);
    }) : e;
  }
  sortRowChildren(e, t, r) {
    var l;
    return (l = e.children) != null && l.length ? {
      ...e,
      children: this.sortRows(e.children, t, r)
    } : e;
  }
  compareRows(e, t, r, l) {
    var i, u;
    if (l.rows.includes(r.fieldId)) {
      const c = ((i = e.cells[0]) == null ? void 0 : i.formatted) || $(e.key), m = ((u = t.cells[0]) == null ? void 0 : u.formatted) || $(t.key);
      return this.compareScalars(c, m, r.direction);
    }
    const o = (c) => this.findMeasureCell(c, r.fieldId, l), s = o(e), a = o(t);
    return s == null && a == null ? 0 : s == null ? 1 : a == null ? -1 : this.compareScalars(s, a, r.direction);
  }
  findMeasureCell(e, t, r) {
    const l = e.cells.find((o) => o.columnKey === t || o.columnKey.endsWith(`__${t}`) || o.columnKey.includes(`__${t}`));
    if ((l == null ? void 0 : l.rawValue) != null)
      return l.rawValue;
    if (r.columns.length === 0) {
      const o = r.values.findIndex((a) => a.fieldId === t), s = e.cells[r.rows.length > 0 ? o + 1 : o];
      return (s == null ? void 0 : s.rawValue) ?? null;
    }
    return (l == null ? void 0 : l.rawValue) ?? null;
  }
  compareScalars(e, t, r) {
    const l = typeof e == "number" ? e : Number(e), o = typeof t == "number" ? t : Number(t), s = Number.isFinite(l) && Number.isFinite(o);
    let a;
    return s ? a = l - o : a = String(e).localeCompare(String(t), "uz-UZ", { numeric: !0, sensitivity: "base" }), r === "desc" ? -a : a;
  }
}
function $e(n) {
  const e = [];
  let t = 0;
  const r = n.trim();
  for (; t < r.length; ) {
    const l = r[t];
    if (/\s/.test(l)) {
      t++;
      continue;
    }
    if (l === "(") {
      e.push({ type: "lparen" }), t++;
      continue;
    }
    if (l === ")") {
      e.push({ type: "rparen" }), t++;
      continue;
    }
    if ("+-*/".includes(l)) {
      e.push({ type: "op", value: l }), t++;
      continue;
    }
    if (/[0-9.]/.test(l)) {
      let o = l;
      for (t++; t < r.length && /[0-9.]/.test(r[t]); )
        o += r[t], t++;
      const s = Number(o);
      if (!Number.isFinite(s))
        throw new Error(`Noto'g'ri son: ${o}`);
      e.push({ type: "number", value: s });
      continue;
    }
    if (/[a-zA-Z_][a-zA-Z0-9_]*/.test(l)) {
      let o = l;
      for (t++; t < r.length && /[a-zA-Z0-9_]/.test(r[t]); )
        o += r[t], t++;
      e.push({ type: "ident", value: o });
      continue;
    }
    throw new Error(`Noto'g'ri belgi: ${l}`);
  }
  return e;
}
class Me {
  constructor(e, t) {
    this.tokens = e, this.allowedFields = t, this.pos = 0;
  }
  parse() {
    const e = this.parseExpr();
    if (this.pos < this.tokens.length)
      throw new Error("Formula ortiqcha belgilar bilan tugadi");
    return (t) => {
      const r = e(t);
      return r != null && Number.isFinite(r) ? r : null;
    };
  }
  parseExpr() {
    let e = this.parseTerm();
    for (; this.pos < this.tokens.length; ) {
      const t = this.tokens[this.pos];
      if (!t || t.type !== "op" || t.value !== "+" && t.value !== "-")
        break;
      this.pos++;
      const r = this.parseTerm(), l = t.value, o = e;
      e = (s) => {
        const a = o(s), i = r(s);
        return a == null || i == null ? null : l === "+" ? a + i : a - i;
      };
    }
    return e;
  }
  parseTerm() {
    let e = this.parseFactor();
    for (; this.pos < this.tokens.length; ) {
      const t = this.tokens[this.pos];
      if (!t || t.type !== "op" || t.value !== "*" && t.value !== "/")
        break;
      this.pos++;
      const r = this.parseFactor(), l = t.value, o = e;
      e = (s) => {
        const a = o(s), i = r(s);
        return a == null || i == null || l === "/" && i === 0 ? null : l === "*" ? a * i : a / i;
      };
    }
    return e;
  }
  parseFactor() {
    const e = this.tokens[this.pos];
    if (!e)
      throw new Error("Formula to'liq emas");
    if (e.type === "number") {
      this.pos++;
      const t = e.value;
      return () => t;
    }
    if (e.type === "ident") {
      if (!this.allowedFields.has(e.value))
        throw new Error(`Ruxsat etilmagan maydon: ${e.value}`);
      this.pos++;
      const t = e.value;
      return (r) => {
        const l = r[t];
        return typeof l == "number" && Number.isFinite(l) ? l : null;
      };
    }
    if (e.type === "lparen") {
      this.pos++;
      const t = this.parseExpr(), r = this.tokens[this.pos];
      if (!r || r.type !== "rparen")
        throw new Error("Yopuvchi qavs kutilgan");
      return this.pos++, t;
    }
    throw new Error("Kutilmagan token");
  }
}
function Oe(n, e) {
  const t = n.trim();
  if (!t)
    throw new Error("Formula bo'sh");
  const r = $e(t);
  return new Me(r, new Set(e)).parse();
}
const Ve = {
  locale: "ru",
  zones: {
    fields: "Поля",
    reportFilters: "⊘ Фильтры",
    columns: "↔ Столбцы",
    rows: "↕ Строки",
    values: "# Значения",
    reportFiltersHint: "Фильтры отчёта",
    columnsHint: "Поля столбцов",
    rowsHint: "Перетащите поле сюда",
    valuesHint: "Метрики (сумма, количество…)"
  },
  toolbar: {
    table: "Таблица",
    chart: "График",
    excel: "Excel",
    csv: "CSV",
    pdf: "PDF",
    html: "HTML",
    fullscreen: "Полный экран",
    exitFullscreen: "Свернуть",
    expandAll: "Развернуть всё",
    collapseAll: "Свернуть всё",
    reset: "Сбросить",
    resetConfig: "Сбросить конфигурацию",
    columnTotals: "Итог по столбцам",
    clearFilters: (n) => `Очистить фильтры (${n})`,
    chartPng: "PNG"
  },
  chart: {
    bar: "Столбцы",
    line: "Линия",
    pie: "Круговая",
    noData: "Нет данных для графика.",
    truncatedCategories: (n, e) => `На графике показаны только первые ${n} категорий (всего ${e}).`,
    largeDatasetWarning: (n) => `Большой набор данных (${n.toLocaleString("ru-RU")}+ строк). График в ограниченном виде.`,
    exporting: "Экспорт PNG…"
  },
  export: {
    largeSourceWarning: (n) => `Большой набор данных (${n.toLocaleString("ru-RU")}+ строк). Экспорт может занять время.`,
    largeExportWarning: (n) => `Экспорт включает ${n.toLocaleString("ru-RU")}+ строк. Процесс будет разбит на части.`,
    confirmLargeExport: (n) => `Будет экспортировано ${n.toLocaleString("ru-RU")}+ строк. Продолжить?`,
    preparing: "Подготовка экспорта…",
    writing: "Запись файла…",
    done: "Экспорт завершён",
    progress: (n, e) => `Экспорт: ${n.toLocaleString("ru-RU")} / ${e.toLocaleString("ru-RU")} строк`,
    exportingExcel: "Экспорт Excel…",
    exportingCsv: "Экспорт CSV…",
    exportingPdf: "Экспорт PDF…",
    exportingHtml: "Экспорт HTML…"
  },
  table: {
    group: "Группа",
    rowsMeta: (n, e, t) => {
      const r = [];
      t != null && t.virtual && r.push(`virtual (${t.virtual})`), t != null && t.fromCache && r.push("кеш"), t != null && t.incremental && r.push("diff");
      const l = r.length ? ` · ${r.join(" · ")}` : "";
      return `${n} строк · ${e} мс${l}`;
    },
    drillThroughHint: "Двойной щелчок — исходные записи",
    expand: "Развернуть",
    collapse: "Свернуть"
  },
  drillThrough: {
    title: "Исходные записи",
    sheetName: "Исходные записи",
    noRows: "Записи не найдены.",
    rowCount: (n) => `${n} строк`,
    showing: (n, e) => `Показано: ${n} / ${e}`,
    close: "Закрыть"
  },
  filters: {
    selected: "Выбранные",
    exclude: "Исключить",
    search: "Поиск…",
    cancel: "Отмена",
    apply: "Применить",
    topN: "Top N",
    topHighest: "Топ",
    topLowest: "Низ",
    nValue: "Значение N",
    metricOptional: "Метрика (необязательно)",
    rowCount: "Количество строк",
    from: "С",
    to: "По",
    min: "Мин.",
    max: "Макс.",
    noOptions: "Варианты не найдены",
    configureFilter: "Настроить фильтр",
    remove: "Удалить",
    reorder: "Изменить порядок",
    filter: "Фильтр",
    filterByValues: "Фильтр по значениям",
    selectAll: "Выделить все",
    selectedOfTotal: (n, e) => `${n} из ${e} выбрано`,
    selectedCount: (n) => `${n}`,
    reportFiltersLabel: "Фильтры отчета",
    activeFiltersCount: (n) => `Активных: ${n}`
  },
  aggregations: {
    SUM: "Сумма",
    COUNT: "Количество",
    AVG: "Среднее",
    MIN: "Минимум",
    MAX: "Максимум",
    COUNT_DISTINCT: "Уникальные",
    PERCENT_OF_ROW: "% строки",
    PERCENT_OF_COLUMN: "% столбца",
    PERCENT_OF_TOTAL: "% итого",
    RUNNING_TOTAL: "Накопительный итог",
    PRODUCT: "Произведение",
    INDEX: "Индекс",
    DIFFERENCE: "Разность",
    CUSTOM: "Пользовательская"
  },
  engine: {
    group: "Группа",
    grandTotal: "Итого",
    subtotal: "Промежуточный итог",
    subtotalInline: (n) => `${n} (пром.)`,
    columnTotal: "Итог по столбцам",
    noValueFields: "Не выбраны поля значений"
  },
  demo: {
    title: "SavdoDesk Pivot Engine",
    subtitle: (n, e, t) => `Автономная демо — ${n} строк тестовых данных${e ? " · Web Worker" : ""}${t ? " · вычисляется…" : ""}`,
    workerHint: "Тест worker: ?rows=10000 — 10k+ строк вычисляются через Web Worker.",
    computing: (n) => `Вычисление сводной таблицы${n ? " (worker)" : ""}…`,
    addMetric: "Добавьте метрику в зону «Значения»."
  },
  reportBuilder: {
    title: "Конструктор сводной таблицы",
    subtitle: "SavdoDesk Virtual Pivot Engine — автономный pivot UI",
    fullDemo: "Полная демо",
    datasetFilters: "Фильтры набора данных",
    loadData: "Загрузить данные",
    savedReports: "Сохранённые отчёты",
    save: "Сохранить",
    computing: "Вычисление сводной таблицы…",
    workerActive: " Web Worker активен.",
    loadingMetadata: "Загрузка метаданных…",
    dragMetricHint: "Перетащите метрику в зону «Значения», затем «Загрузить данные».",
    wdrImport: "Импорт WDR",
    wdrSliceJson: "WDR slice JSON",
    savedReportIncompatible: "Сохранённый отчёт несовместим с Virtual Pivot.",
    wdrSliceNotFound: "WDR slice JSON не найден.",
    jsonReadError: "Не удалось прочитать JSON.",
    savePrompt: "Название отчёта:",
    savedReportWdrSuffix: " (WDR)",
    sliceTemplatesLabel: "Шаблоны среза",
    datasetTruncated: (n, e) => `Показано не более ${n} строк из ${e}. Сузьте фильтры или выгрузите таблицу через «Экспорт» (Excel).`,
    pivotRowsTruncated: (n, e) => `Для сводной таблицы показано ${n} из ${e} строк (лимит). Сузьте фильтры или смените разметку.`,
    computeFailed: (n) => `Не удалось вычислить сводную таблицу${n ? `: ${n}` : "."}`,
    largeDatasetHint: (n) => `Большой набор (${n} строк): вычисление может занять время. Интерфейс не завис — дождитесь окончания.`,
    exportDocumentTitle: "Конструктор сводной таблицы"
  },
  sliceTemplates: [
    {
      id: "agent_kpi",
      label: "KPI агента",
      description: "Супервайзер → агент, сумма + AKB (COUNT_DISTINCT)"
    },
    {
      id: "retrobonus_volume",
      label: "Объём ретробонуса",
      description: "Объём по агенту — совместимо с RETROBONUS_TIER_PRESETS"
    },
    {
      id: "flat_sales_detail",
      label: "Плоская (детальный)",
      description: "Табличная форма: дилер, бренд, агент, объём, даты — без агрегации"
    },
    {
      id: "classic_branch_brand",
      label: "Классическая (дилер → бренд)",
      description: "Классическая форма: дилер, бренд, SKU + объём/сумма; ота ячейки без повтора"
    }
  ],
  calculatedMeasurePresets: [
    {
      id: "bonus_5pct",
      label: "Бонус 5%",
      formula: "amount * 0.05",
      description: "Сумма × 5%"
    },
    {
      id: "vat_12pct",
      label: "НДС 12%",
      formula: "amount * 0.12",
      description: "Сумма × 12%"
    },
    {
      id: "avg_check",
      label: "Средний чек",
      formula: "amount / qty",
      description: "Сумма / Количество"
    },
    {
      id: "retrobonus_row_2pct",
      label: "Ретробонус 2% (строка)",
      formula: "amount * 0.02",
      description: "2% на уровне строки — полные уровни: RETROBONUS_TIER_PRESETS",
      tierPresetId: "retro_std"
    },
    {
      id: "retrobonus_row_5pct",
      label: "Ретробонус 5% (строка)",
      formula: "amount * 0.05",
      description: "Премиум уровень 5% — Aggregator.calculateRetrobonus",
      tierPresetId: "retro_premium"
    }
  ]
}, Pe = {
  locale: "uz",
  zones: {
    fields: "Maydonlar",
    reportFilters: "⊘ Filtrlar",
    columns: "↔ Ustunlar",
    rows: "↕ Qatorlar",
    values: "# Qiymatlar",
    reportFiltersHint: "Hisobot filtrlari",
    columnsHint: "Ustun maydonlari",
    rowsHint: "Maydonni bu yerga torting",
    valuesHint: "Metrikalar (summa, miqdor…)"
  },
  toolbar: {
    table: "Jadval",
    chart: "Grafik",
    excel: "Excel",
    csv: "CSV",
    pdf: "PDF",
    html: "HTML",
    fullscreen: "To'liq ekran",
    exitFullscreen: "Kichik",
    expandAll: "Hammasini yoyish",
    collapseAll: "Hammasini yig'ish",
    reset: "Tiklash",
    resetConfig: "Konfiguratsiyani tiklash",
    columnTotals: "Ustun jami",
    clearFilters: (n) => `Filtrlarni tozalash (${n})`,
    chartPng: "PNG"
  },
  chart: {
    bar: "Ustun",
    line: "Chiziq",
    pie: "Doira",
    noData: "Grafik uchun ma'lumot yo'q.",
    truncatedCategories: (n, e) => `Grafikda faqat birinchi ${n} ta kategoriya ko'rsatiladi (jami ${e}).`,
    largeDatasetWarning: (n) => `Katta ma'lumot to'plami (${n.toLocaleString("uz-UZ")}+ qator). Grafik cheklangan ko'rinishda.`,
    exporting: "PNG eksport qilinmoqda…"
  },
  export: {
    largeSourceWarning: (n) => `Katta ma'lumot to'plami (${n.toLocaleString("uz-UZ")}+ qator). Eksport biroz vaqt olishi mumkin.`,
    largeExportWarning: (n) => `Eksport ${n.toLocaleString("uz-UZ")}+ qatorni o'z ichiga oladi. Jarayon bo'laklarga bo'linadi.`,
    confirmLargeExport: (n) => `${n.toLocaleString("uz-UZ")}+ qator eksport qilinadi. Davom etasizmi?`,
    preparing: "Eksport tayyorlanmoqda…",
    writing: "Fayl yozilmoqda…",
    done: "Eksport yakunlandi",
    progress: (n, e) => `Eksport: ${n.toLocaleString("uz-UZ")} / ${e.toLocaleString("uz-UZ")} qator`,
    exportingExcel: "Excel eksport qilinmoqda…",
    exportingCsv: "CSV eksport qilinmoqda…",
    exportingPdf: "PDF eksport qilinmoqda…",
    exportingHtml: "HTML eksport qilinmoqda…"
  },
  table: {
    group: "Guruh",
    rowsMeta: (n, e, t) => {
      const r = [];
      t != null && t.virtual && r.push(`virtual (${t.virtual})`), t != null && t.fromCache && r.push("kesh"), t != null && t.incremental && r.push("diff");
      const l = r.length ? ` · ${r.join(" · ")}` : "";
      return `${n} qator · ${e} ms${l}`;
    },
    drillThroughHint: "Ikki marta bosing — manba qatorlar",
    expand: "Yoyish",
    collapse: "Yig'ish"
  },
  drillThrough: {
    title: "Manba qatorlar",
    sheetName: "Manba qatorlar",
    noRows: "Qatorlar topilmadi.",
    rowCount: (n) => `${n} ta qator`,
    showing: (n, e) => `Ko'rsatilgan: ${n} / ${e}`,
    close: "Yopish"
  },
  filters: {
    selected: "Tanlangan",
    exclude: "Istisno",
    search: "Qidirish…",
    cancel: "Bekor",
    apply: "Qo'llash",
    topN: "Top N",
    topHighest: "Eng yuqori",
    topLowest: "Eng past",
    nValue: "N qiymat",
    metricOptional: "Metrika (ixtiyoriy)",
    rowCount: "Qatorlar soni",
    from: "Dan",
    to: "Gacha",
    min: "Min",
    max: "Max",
    noOptions: "Variant topilmadi",
    configureFilter: "Filtr sozlash",
    remove: "Olib tashlash",
    reorder: "Qayta tartiblash",
    filter: "Filtr",
    filterByValues: "Qiymatlar bo‘yicha filtr",
    selectAll: "Hammasini belgilash",
    selectedOfTotal: (n, e) => `${n} / ${e} tanlangan`,
    selectedCount: (n) => `${n} ta`,
    reportFiltersLabel: "Hisobot filtrlari",
    activeFiltersCount: (n) => `Faol: ${n}`
  },
  aggregations: {
    SUM: "Yig'indi",
    COUNT: "Soni",
    AVG: "O'rtacha",
    MIN: "Minimum",
    MAX: "Maksimum",
    COUNT_DISTINCT: "Noyob",
    PERCENT_OF_ROW: "% qator",
    PERCENT_OF_COLUMN: "% ustun",
    PERCENT_OF_TOTAL: "% jami",
    RUNNING_TOTAL: "Yig'indiy jami",
    PRODUCT: "Ko'paytma",
    INDEX: "Indeks",
    DIFFERENCE: "Farq",
    CUSTOM: "Maxsus"
  },
  engine: {
    group: "Guruh",
    grandTotal: "Jami",
    subtotal: "Oraliq jami",
    subtotalInline: (n) => `${n} (oraliq)`,
    columnTotal: "Ustun jami",
    noValueFields: "Qiymat maydonlari tanlanmagan"
  },
  demo: {
    title: "SavdoDesk Pivot Engine",
    subtitle: (n, e, t) => `Mustaqil demo — ${n} qator mock ma'lumot${e ? " · Web Worker" : ""}${t ? " · hisoblanmoqda…" : ""}`,
    workerHint: "Worker test: ?rows=10000 — 10k+ qator Web Worker orqali hisoblanadi.",
    computing: (n) => `Pivot hisoblanmoqda${n ? " (worker)" : ""}…`,
    addMetric: "Qiymatlar zonasiga metrika qo'shing."
  },
  reportBuilder: {
    title: "Jadval konstruktor",
    subtitle: "SavdoDesk Virtual Pivot Engine — mustaqil pivot UI",
    fullDemo: "To'liq demo",
    datasetFilters: "Dataset filtrlari",
    loadData: "Ma'lumotni yuklash",
    savedReports: "Saqlangan hisobotlar",
    save: "Saqlash",
    computing: "Pivot hisoblanmoqda…",
    workerActive: " Web Worker faol.",
    loadingMetadata: "Metadata yuklanmoqda…",
    dragMetricHint: "Qiymatlar zonasiga metrika torting, keyin «Ma'lumotni yuklash».",
    wdrImport: "WDR import",
    wdrSliceJson: "WDR slice JSON",
    savedReportIncompatible: "Saqlangan hisobot Virtual Pivot formatiga mos emas.",
    wdrSliceNotFound: "WDR slice JSON topilmadi.",
    jsonReadError: "JSON o'qib bo'lmadi.",
    savePrompt: "Hisobot nomi:",
    savedReportWdrSuffix: " (WDR)",
    sliceTemplatesLabel: "Slice shablonlari",
    datasetTruncated: (n, e) => `Ko'pi bilan ${n} qator ko'rsatildi (jami ${e}). Filtrlarni toraytiring yoki «Eksport» (Excel) orqali yuklab oling.`,
    pivotRowsTruncated: (n, e) => `Pivot jadvalda ${n} / ${e} qator ko'rsatildi (limit). Filtrlarni toraytiring yoki sxemani o'zgartiring.`,
    computeFailed: (n) => `Pivot hisoblanmadi${n ? `: ${n}` : "."}`,
    largeDatasetHint: (n) => `Katta to'plam (${n} qator): hisoblash vaqt olishi mumkin. Interfeys osilib qolmagan — tugashini kuting.`,
    exportDocumentTitle: "Jadval konstruktor"
  },
  sliceTemplates: [
    {
      id: "agent_kpi",
      label: "Agent KPI",
      description: "Supervisor → agent, summa + AKB (COUNT_DISTINCT)"
    },
    {
      id: "retrobonus_volume",
      label: "Retrobonus hajm",
      description: "Agent bo'yicha hajm — RETROBONUS_TIER_PRESETS bilan mos"
    },
    {
      id: "flat_sales_detail",
      label: "Tekis (batafsil)",
      description: "Jadvalli forma: diler, brend, agent, hajm, sanalar — agregatsiyasiz"
    },
    {
      id: "classic_branch_brand",
      label: "Klassik (diler → brend)",
      description: "Klassik forma: diler, brend, SKU + hajm/summa; ota kataklar takrorlanmaydi"
    }
  ],
  calculatedMeasurePresets: [
    {
      id: "bonus_5pct",
      label: "Bonus 5%",
      formula: "amount * 0.05",
      description: "Summa × 5%"
    },
    {
      id: "vat_12pct",
      label: "QQS 12%",
      formula: "amount * 0.12",
      description: "Summa × 12%"
    },
    {
      id: "avg_check",
      label: "O'rtacha chek",
      formula: "amount / qty",
      description: "Summa / Miqdor"
    },
    {
      id: "retrobonus_row_2pct",
      label: "Retrobonus 2% (qator)",
      formula: "amount * 0.02",
      description: "Qator darajasida 2% — to'liq tier: RETROBONUS_TIER_PRESETS",
      tierPresetId: "retro_std"
    },
    {
      id: "retrobonus_row_5pct",
      label: "Retrobonus 5% (qator)",
      formula: "amount * 0.05",
      description: "Premium tier 5% — Aggregator.calculateRetrobonus",
      tierPresetId: "retro_premium"
    }
  ]
}, xe = { ru: Ve, uz: Pe };
let Ue = "ru";
function h() {
  return xe[Ue];
}
function ne(n, e, t) {
  if (!e.length)
    return n;
  const r = t.filter((o) => o.dataType === "number" || o.dataType === "currency").map((o) => o.id), l = /* @__PURE__ */ new Map();
  for (const o of e) {
    const s = [...r, ...e.map((a) => a.id).filter((a) => a !== o.id)];
    l.set(o.id, Oe(o.formula, s));
  }
  return n.map((o) => {
    const s = { ...o };
    for (const a of e) {
      const u = l.get(a.id)(s);
      u != null && (s[a.id] = u);
    }
    return s;
  });
}
function U(n) {
  return n.map((e) => ({
    id: e.id,
    label: e.label,
    dataType: "number",
    format: e.format
  }));
}
function W(n) {
  return n.filters.filter((e) => n.reportFilters.includes(e.fieldId) || n.rows.includes(e.fieldId) || n.columns.includes(e.fieldId) || n.values.some((t) => t.fieldId === e.fieldId));
}
const qe = new H();
function Le(n, e, t, r) {
  const l = W(t);
  let o = qe.apply(n, l, e);
  return t.options.maxRows && (o = o.slice(0, t.options.maxRows)), o = Ae(o, t, r.rowGroupKey), o = He(o, t, r.columnKey, r.valueFieldId), o;
}
function Ae(n, e, t) {
  if (!e.rows.length || t === K || t === "__all__")
    return n;
  const r = S(t), l = Math.min(r.length, e.rows.length);
  return n.filter((o) => e.rows.slice(0, l).every((s, a) => String(o[s] ?? "N/A") === r[a]));
}
function He(n, e, t, r) {
  if (!e.columns.length)
    return n;
  const l = t.includes("__") ? t.split("__")[0] : t === r ? v : t;
  if (l === v)
    return n;
  const o = S(l);
  return n.filter((s) => e.columns.every((a, i) => String(s[a] ?? "N/A") === o[i]));
}
const I = "—", G = "uz-UZ";
function We(n, e = []) {
  const t = new Map(e.map((o) => [o.id, o])), r = /* @__PURE__ */ new Set(), l = (o, s) => {
    ((o == null ? void 0 : o.type) === "currency" || s === "currency") && r.add(((o == null ? void 0 : o.currency) ?? "UZS").toUpperCase());
  };
  for (const o of n.values) {
    const s = t.get(o.fieldId);
    l(o.format ?? (s == null ? void 0 : s.format), s == null ? void 0 : s.dataType);
  }
  for (const o of n.calculatedMeasures ?? [])
    l(o.format);
  return [...r];
}
function O(n, e = []) {
  return We(n, e).length > 1;
}
function C(n, e, t) {
  if (n == null)
    return I;
  if (!e)
    return typeof n == "number" ? n.toLocaleString(G) : n instanceof Date ? ee(n, e) : String(n);
  switch (e.type) {
    case "currency":
      return Ge(Number(n), e, t);
    case "percent":
      return ze(Number(n), e);
    case "date":
      return ee(n instanceof Date ? n : new Date(String(n)), e);
    case "number":
      return re(Number(n), e);
    default:
      return String(n);
  }
}
function Ge(n, e, t) {
  if (!Number.isFinite(n))
    return I;
  const r = (e == null ? void 0 : e.decimals) ?? 0;
  if (!((t == null ? void 0 : t.showCurrency) === !0))
    return re(n, { decimals: r });
  const o = (e == null ? void 0 : e.currency) ?? "UZS";
  return new Intl.NumberFormat(G, {
    style: "currency",
    currency: o,
    minimumFractionDigits: r,
    maximumFractionDigits: r
  }).format(n);
}
function ze(n, e) {
  if (!Number.isFinite(n))
    return I;
  const t = (e == null ? void 0 : e.decimals) ?? 1;
  return `${n.toFixed(t)}%`;
}
function re(n, e) {
  if (!Number.isFinite(n))
    return I;
  const t = (e == null ? void 0 : e.decimals) ?? 0;
  return new Intl.NumberFormat(G, {
    minimumFractionDigits: t,
    maximumFractionDigits: (e == null ? void 0 : e.decimals) ?? 2
  }).format(n);
}
function ee(n, e) {
  if (Number.isNaN(n.getTime()))
    return I;
  const t = (e == null ? void 0 : e.dateFormat) ?? "dd.MM.yyyy", r = (s) => String(s).padStart(2, "0"), l = [
    ["yyyy", String(n.getFullYear())],
    ["YYYY", String(n.getFullYear())],
    ["MM", r(n.getMonth() + 1)],
    ["dd", r(n.getDate())],
    ["DD", r(n.getDate())],
    ["HH", r(n.getHours())],
    ["mm", r(n.getMinutes())],
    ["ss", r(n.getSeconds())]
  ];
  let o = t;
  for (const [s, a] of l)
    o.includes(s) && (o = o.split(s).join(a));
  return o;
}
function je(n) {
  const e = [
    ...n.rows,
    ...n.columns,
    ...n.values.map((l) => l.fieldId)
  ], t = /* @__PURE__ */ new Set(), r = [];
  for (const l of e)
    t.has(l) || (t.add(l), r.push(l));
  return r;
}
function Be(n, e, t) {
  if (n == null || n === "")
    return { value: null, rawValue: null, formatted: "(blank)", isEmpty: !0 };
  if ((e == null ? void 0 : e.dataType) === "number" || (e == null ? void 0 : e.dataType) === "currency") {
    const l = typeof n == "number" ? n : Number(n);
    if (Number.isFinite(l))
      return {
        value: l,
        rawValue: l,
        formatted: C(l, e.format, { showCurrency: t }),
        isEmpty: !1
      };
  }
  if (n instanceof Date || (e == null ? void 0 : e.dataType) === "date") {
    const l = n instanceof Date ? n : new Date(String(n));
    if (!Number.isNaN(l.getTime()))
      return {
        value: l.toISOString(),
        rawValue: null,
        formatted: C(l, (e == null ? void 0 : e.format) ?? { type: "date" }, { showCurrency: t }),
        isEmpty: !1
      };
  }
  const r = String(n).trim();
  return r ? {
    value: r,
    rawValue: null,
    formatted: C(r, e == null ? void 0 : e.format, { showCurrency: t }),
    isEmpty: !1
  } : { value: null, rawValue: null, formatted: "(blank)", isEmpty: !0 };
}
function Ye(n, e, t, r = performance.now()) {
  const l = [], o = je(t);
  if (!o.length)
    return {
      headers: [],
      rows: [],
      metadata: {
        totalRows: n.length,
        processedRows: 0,
        executionTime: performance.now() - r,
        warnings: [h().engine.noValueFields]
      }
    };
  const s = new H(), a = W(t);
  let i = s.apply(n, a, e);
  i = ne(i, t.calculatedMeasures ?? [], e), t.options.maxRows && i.length > t.options.maxRows && (l.push(h().reportBuilder.pivotRowsTruncated(String(t.options.maxRows), String(i.length))), i = i.slice(0, t.options.maxRows));
  const u = [...e, ...U(t.calculatedMeasures ?? [])], c = new Map(u.map((g) => [g.id, g])), m = O(t, u), d = [
    o.map((g) => {
      const p = c.get(g);
      return {
        key: g,
        label: (p == null ? void 0 : p.label) ?? g,
        depth: 0,
        colspan: 1,
        rowspan: 1,
        isValue: (p == null ? void 0 : p.dataType) === "number" || (p == null ? void 0 : p.dataType) === "currency"
      };
    })
  ], f = i.map((g, p) => {
    const b = o.map((y) => {
      const R = c.get(y), { value: _, rawValue: k, formatted: E, isEmpty: V } = Be(g[y], R, m);
      return {
        columnKey: y,
        value: _,
        rawValue: k,
        formatted: E,
        isEmpty: V
      };
    });
    return { key: `flat-${p}`, depth: 0, cells: b };
  });
  let w;
  if (t.options.showGrandTotal && i.length > 0) {
    const g = o.map((p, b) => {
      const y = c.get(p), R = (y == null ? void 0 : y.dataType) === "number" || (y == null ? void 0 : y.dataType) === "currency";
      if (b === 0)
        return {
          columnKey: p,
          value: h().engine.grandTotal,
          rawValue: null,
          formatted: h().engine.grandTotal,
          isEmpty: !1
        };
      if (!R)
        return {
          columnKey: p,
          value: null,
          rawValue: null,
          formatted: "",
          isEmpty: !0
        };
      let _ = 0;
      for (const k of i) {
        const E = Number(k[p]);
        Number.isFinite(E) && (_ += E);
      }
      return {
        columnKey: p,
        value: _,
        rawValue: _,
        formatted: C(_, y == null ? void 0 : y.format, { showCurrency: m }),
        isEmpty: !1
      };
    });
    w = { label: h().engine.grandTotal, cells: g };
  }
  return {
    headers: d,
    rows: f,
    grandTotal: w,
    metadata: {
      totalRows: n.length,
      processedRows: i.length,
      executionTime: performance.now() - r,
      warnings: l
    }
  };
}
function Ze(n) {
  return n ? n.layoutForm === "flat" || n.layoutForm === "classic" || n.layoutForm === "compact" ? n.layoutForm : n.compactMode ? "compact" : "classic" : "compact";
}
function Je(n) {
  return n.rows.length > 0 || n.columns.length > 0 || n.values.length > 0 || n.reportFilters.length > 0;
}
function Qe(n, e) {
  var o, s;
  const t = (o = n.label) == null ? void 0 : o.trim();
  if (t)
    return t;
  const r = e instanceof Map ? e.get(n.fieldId) : e.find((a) => a.id === n.fieldId), l = (s = r == null ? void 0 : r.label) == null ? void 0 : s.trim();
  return l || n.fieldId;
}
function N(n, e) {
  var t;
  if (e.columns.length > 0) {
    const r = n.split("__");
    if (r.length > 1)
      return r.slice(1).join("__");
  }
  return ((t = e.values.find((r) => r.fieldId === n)) == null ? void 0 : t.fieldId) ?? null;
}
function z(n, e) {
  var r;
  const t = N(n, e);
  return t ? ((r = e.values.find((l) => l.fieldId === t)) == null ? void 0 : r.aggregation) ?? null : null;
}
function le(n) {
  const e = [];
  function t(r) {
    var l;
    for (const o of r.cells)
      o.columnKey !== "__row_label__" && e.push(o);
    if ((l = r.children) == null || l.forEach(t), r.subtotal)
      for (const o of r.subtotal.cells)
        o.columnKey !== "__row_label__" && e.push(o);
  }
  return n.forEach(t), e;
}
function Xe(n) {
  const e = /* @__PURE__ */ new Map();
  for (const t of le(n))
    t.rawValue == null || !Number.isFinite(t.rawValue) || e.set(t.columnKey, (e.get(t.columnKey) ?? 0) + t.rawValue);
  return e;
}
function et(n, e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of le(n)) {
    const l = N(r.columnKey, e);
    !l || r.rawValue == null || !Number.isFinite(r.rawValue) || t.set(l, (t.get(l) ?? 0) + r.rawValue);
  }
  return t;
}
function oe(n, e, t) {
  let r = 0;
  for (const l of n.cells)
    l.columnKey === "__row_label__" || N(l.columnKey, t) !== e || l.rawValue != null && Number.isFinite(l.rawValue) && (r += l.rawValue);
  return r;
}
function q(n, e, t, r) {
  const l = /* @__PURE__ */ new Map();
  return n.map((o) => {
    if (o.columnKey === "__row_label__" || z(o.columnKey, e) !== "DIFFERENCE")
      return o;
    const s = N(o.columnKey, e), a = s ? t.get(s) : void 0;
    if (!a || !s)
      return o;
    const i = o.rawValue;
    if (i == null || !Number.isFinite(i))
      return { ...o, value: null, rawValue: null, formatted: "—", isEmpty: !0 };
    const u = l.get(s);
    if (l.set(s, i), u == null)
      return { ...o, value: null, rawValue: null, formatted: "—", isEmpty: !0 };
    const c = i - u;
    return {
      ...o,
      value: c,
      rawValue: c,
      formatted: C(c, a.format, { showCurrency: r }),
      isEmpty: !1
    };
  });
}
function se(n, e, t, r) {
  var l;
  n.cells = q(n.cells, e, t, r), (l = n.children) == null || l.forEach((o) => se(o, e, t, r)), n.subtotal && (n.subtotal = {
    ...n.subtotal,
    cells: q(n.subtotal.cells, e, t, r)
  });
}
function te(n, e, t, r) {
  return {
    ...n,
    cells: q(n.cells, e, t, r)
  };
}
function tt(n, e) {
  if (!e.values.some((s) => s.aggregation === "DIFFERENCE"))
    return n;
  const r = O(e), l = new Map(e.values.map((s) => [s.fieldId, s])), o = n.rows.map((s) => {
    const a = { ...s, cells: [...s.cells] };
    return se(a, e, l, r), a;
  });
  return {
    ...n,
    rows: o,
    columnTotals: n.columnTotals ? te(n.columnTotals, e, l, r) : void 0,
    grandTotal: n.grandTotal ? te(n.grandTotal, e, l, r) : void 0
  };
}
function ae(n, e, t, r, l, o) {
  if (e == null || t == null || r == null || l == null || t === 0 || r === 0)
    return { ...n, value: null, rawValue: null, formatted: "—", isEmpty: !0 };
  const s = e * l / (t * r);
  return {
    ...n,
    value: s,
    rawValue: s,
    formatted: C(s, o.format ?? { type: "number", decimals: 2 }),
    isEmpty: !1
  };
}
function ie(n, e, t, r, l) {
  var o;
  n.cells = n.cells.map((s) => {
    if (s.columnKey === "__row_label__" || z(s.columnKey, e) !== "INDEX")
      return s;
    const a = N(s.columnKey, e), i = a ? l.get(a) : void 0;
    return !i || !a ? s : ae(s, s.rawValue, oe(n, a, e), t.get(s.columnKey) ?? null, r.get(a) ?? null, i);
  }), (o = n.children) == null || o.forEach((s) => ie(s, e, t, r, l)), n.subtotal && (n.subtotal = L(n.subtotal, e, t, r, l, n));
}
function L(n, e, t, r, l, o) {
  return {
    ...n,
    cells: n.cells.map((s) => {
      if (s.columnKey === "__row_label__" || z(s.columnKey, e) !== "INDEX")
        return s;
      const a = N(s.columnKey, e), i = a ? l.get(a) : void 0;
      if (!i || !a)
        return s;
      const u = o ? oe(o, a, e) : t.get(s.columnKey) ?? null;
      return ae(s, s.rawValue, u, t.get(s.columnKey) ?? null, r.get(a) ?? null, i);
    })
  };
}
function nt(n, e) {
  if (!e.values.some((u) => u.aggregation === "INDEX"))
    return n;
  const r = new Map(e.values.map((u) => [u.fieldId, u])), l = Xe(n.rows), o = et(n.rows, e), s = n.rows.map((u) => {
    const c = { ...u, cells: [...u.cells] };
    return ie(c, e, l, o, r), c;
  });
  let a = n.columnTotals;
  a && (a = L(a, e, l, o, r));
  let i = n.grandTotal;
  return i && (i = L(i, e, l, o, r)), { ...n, rows: s, columnTotals: a, grandTotal: i };
}
const rt = [
  "PERCENT_OF_TOTAL",
  "PERCENT_OF_ROW",
  "PERCENT_OF_COLUMN"
];
function j(n) {
  return rt.includes(n);
}
function D(n, e) {
  var t;
  if (e.columns.length > 0) {
    const r = n.split("__");
    if (r.length > 1)
      return r.slice(1).join("__");
  }
  return ((t = e.values.find((r) => r.fieldId === n)) == null ? void 0 : t.fieldId) ?? null;
}
function ue(n, e) {
  var r;
  const t = D(n, e);
  return t ? ((r = e.values.find((l) => l.fieldId === t)) == null ? void 0 : r.aggregation) ?? null : null;
}
function lt(n) {
  return n.format ?? { type: "percent", decimals: 1 };
}
function ce(n, e, t, r) {
  if (e == null || t == null || t === 0)
    return {
      ...n,
      value: null,
      rawValue: null,
      formatted: "—",
      isEmpty: !0
    };
  const l = e / t * 100;
  return {
    ...n,
    value: l,
    rawValue: l,
    formatted: C(l, lt(r)),
    isEmpty: !1
  };
}
function me(n) {
  const e = [];
  function t(r) {
    var l;
    for (const o of r.cells)
      o.columnKey !== "__row_label__" && e.push(o);
    if ((l = r.children) == null || l.forEach(t), r.subtotal)
      for (const o of r.subtotal.cells)
        o.columnKey !== "__row_label__" && e.push(o);
  }
  return n.forEach(t), e;
}
function ot(n) {
  const e = /* @__PURE__ */ new Map();
  for (const t of me(n))
    t.rawValue == null || !Number.isFinite(t.rawValue) || e.set(t.columnKey, (e.get(t.columnKey) ?? 0) + t.rawValue);
  return e;
}
function st(n, e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of me(n)) {
    const l = D(r.columnKey, e);
    !l || r.rawValue == null || !Number.isFinite(r.rawValue) || t.set(l, (t.get(l) ?? 0) + r.rawValue);
  }
  return t;
}
function de(n, e, t) {
  let r = 0;
  for (const l of n.cells)
    l.columnKey === "__row_label__" || D(l.columnKey, t) !== e || l.rawValue != null && Number.isFinite(l.rawValue) && (r += l.rawValue);
  return r;
}
function pe(n, e, t, r, l) {
  var o;
  n.cells = n.cells.map((s) => {
    if (s.columnKey === "__row_label__")
      return s;
    const a = ue(s.columnKey, e);
    if (!a || !j(a))
      return s;
    const i = D(s.columnKey, e), u = i ? l.get(i) : void 0;
    if (!u)
      return s;
    const c = s.rawValue;
    let m = null;
    return a === "PERCENT_OF_TOTAL" ? m = i ? r.get(i) ?? null : null : a === "PERCENT_OF_ROW" ? m = de(n, u.fieldId, e) : a === "PERCENT_OF_COLUMN" && (m = t.get(s.columnKey) ?? null), ce(s, c, m, u);
  }), (o = n.children) == null || o.forEach((s) => pe(s, e, t, r, l)), n.subtotal && (n.subtotal = he(n.subtotal, e, t, r, l, n));
}
function he(n, e, t, r, l, o) {
  return {
    ...n,
    cells: n.cells.map((s) => {
      if (s.columnKey === "__row_label__")
        return s;
      const a = ue(s.columnKey, e);
      if (!a || !j(a))
        return s;
      const i = D(s.columnKey, e), u = i ? l.get(i) : void 0;
      if (!u)
        return s;
      const c = s.rawValue;
      let m = null;
      return a === "PERCENT_OF_TOTAL" && i ? m = r.get(i) ?? null : a === "PERCENT_OF_COLUMN" ? m = t.get(s.columnKey) ?? null : a === "PERCENT_OF_ROW" && o ? m = de(o, u.fieldId, e) : a === "PERCENT_OF_ROW" && (m = t.get(s.columnKey) ?? null), ce(s, c, m, u);
    })
  };
}
function at(n, e) {
  if (!e.values.some((i) => j(i.aggregation)))
    return n;
  const r = new Map(e.values.map((i) => [i.fieldId, i])), l = ot(n.rows), o = st(n.rows, e), s = n.rows.map((i) => {
    const u = { ...i, cells: [...i.cells] };
    return pe(u, e, l, o, r), u;
  });
  let a = n.grandTotal;
  return a && (a = he(a, e, l, o, r)), { ...n, rows: s, grandTotal: a };
}
function B(n, e) {
  var t;
  if (e.columns.length > 0) {
    const r = n.split("__");
    if (r.length > 1)
      return r.slice(1).join("__");
  }
  return ((t = e.values.find((r) => r.fieldId === n)) == null ? void 0 : t.fieldId) ?? null;
}
function fe(n, e) {
  var r;
  const t = B(n, e);
  return t ? ((r = e.values.find((l) => l.fieldId === t)) == null ? void 0 : r.aggregation) ?? null : null;
}
function ge(n, e) {
  var t;
  for (const r of n)
    e(r), (t = r.children) != null && t.length && ge(r.children, e);
}
function ye(n, e, t, r) {
  return {
    ...n,
    value: e,
    rawValue: e,
    formatted: C(e, t.format, { showCurrency: r }),
    isEmpty: !1
  };
}
function it(n, e, t, r, l) {
  ge(n, (o) => {
    o.cells = o.cells.map((s) => {
      if (s.columnKey === "__row_label__" || fe(s.columnKey, e) !== "RUNNING_TOTAL")
        return s;
      const i = B(s.columnKey, e), u = i ? t.get(i) : void 0;
      if (!u)
        return s;
      const c = s.rawValue ?? 0, d = (r.get(s.columnKey) ?? 0) + c;
      return r.set(s.columnKey, d), ye(s, d, u, l);
    }), o.subtotal && (o.subtotal = A(o.subtotal, e, t, r, l));
  });
}
function A(n, e, t, r, l) {
  return {
    ...n,
    cells: n.cells.map((o) => {
      if (o.columnKey === "__row_label__" || fe(o.columnKey, e) !== "RUNNING_TOTAL")
        return o;
      const a = B(o.columnKey, e), i = a ? t.get(a) : void 0;
      if (!i)
        return o;
      const u = r.get(o.columnKey) ?? o.rawValue ?? 0;
      return ye(o, u, i, l);
    })
  };
}
function ut(n, e) {
  if (!e.values.some((u) => u.aggregation === "RUNNING_TOTAL"))
    return n;
  const r = O(e), l = new Map(e.values.map((u) => [u.fieldId, u])), o = /* @__PURE__ */ new Map(), s = n.rows.map((u) => ({ ...u, cells: [...u.cells] }));
  it(s, e, l, o, r);
  let a = n.columnTotals;
  a && (a = A(a, e, l, o, r));
  let i = n.grandTotal;
  return i && (i = A(i, e, l, o, r)), { ...n, rows: s, columnTotals: a, grandTotal: i };
}
class Y {
  constructor() {
    this.aggregator = new Ne(), this.filterEngine = new H(), this.transformer = new De(), this.sortEngine = new Ke(), this.cubeStore = new ke(), this.cube = new P(), this.resultCache = null, this.incrementalContext = null, this.showCurrencySuffix = !1;
  }
  /** Drill-through: katakdagi manba qatorlar. */
  static getDrillThroughRecords(e, t, r, l) {
    const o = [
      ...t,
      ...U(r.calculatedMeasures ?? [])
    ];
    return Le(e, o, r, l);
  }
  getDrillThroughRecords(e, t, r, l) {
    return Y.getDrillThroughRecords(e, t, r, l);
  }
  /** CubeStore va natija keshini tozalash (testlar uchun). */
  clearCache() {
    this.cubeStore.clear(), this.resultCache = null, this.incrementalContext = null;
  }
  get cubeCacheSize() {
    return this.cubeStore.size;
  }
  compute(e, t, r) {
    var Q, X;
    const l = performance.now(), o = [];
    if (Ze(r.options) === "flat")
      return Je(r) ? Ye(e, t, r, l) : {
        headers: [],
        rows: [],
        metadata: {
          totalRows: e.length,
          processedRows: 0,
          executionTime: performance.now() - l,
          warnings: [h().engine.noValueFields]
        }
      };
    if (!r.values.length)
      return {
        headers: [],
        rows: [],
        metadata: {
          totalRows: e.length,
          processedRows: 0,
          executionTime: performance.now() - l,
          warnings: [h().engine.noValueFields]
        }
      };
    const a = W(r), i = this.filterEngine.apply(e, a, t);
    let u = ne(i, r.calculatedMeasures ?? [], t);
    if (r.options.maxRows && u.length > r.options.maxRows) {
      const T = h();
      o.push(T.reportBuilder.pivotRowsTruncated(String(r.options.maxRows), String(u.length))), u = u.slice(0, r.options.maxRows);
    }
    const c = [
      ...t,
      ...U(r.calculatedMeasures ?? [])
    ];
    this.showCurrencySuffix = O(r, c);
    const m = x(u), d = Se(r), f = ve(r), w = `${m}|${f}`;
    if (((Q = this.resultCache) == null ? void 0 : Q.key) === w)
      return {
        ...this.resultCache.result,
        metadata: {
          ...this.resultCache.result.metadata,
          executionTime: performance.now() - l,
          fromCache: !0
        }
      };
    const g = this.cubeStore.get(m, d);
    let p = !1;
    if (g)
      this.cube = g.cube;
    else if (((X = this.incrementalContext) == null ? void 0 : X.configHash) === d && Ie(this.incrementalContext.filteredData, u)) {
      const T = this.cubeStore.get(this.incrementalContext.dataHash, d);
      if (T) {
        const F = u.slice(this.incrementalContext.filteredData.length);
        this.cube = T.cube, this.cube.appendRows(F, r), p = !0, this.cubeStore.set({
          cube: this.cube,
          filteredData: u,
          dataHash: m,
          configHash: d
        });
      } else
        this.cube = new P(), this.cube.build(u, r), this.cubeStore.set({
          cube: this.cube,
          filteredData: u,
          dataHash: m,
          configHash: d
        });
    } else
      this.cube = new P(), this.cube.build(u, r), this.cubeStore.set({
        cube: this.cube,
        filteredData: u,
        dataHash: m,
        configHash: d
      });
    this.incrementalContext = { configHash: d, filteredData: u, dataHash: m };
    let b = this.buildColSpecs(u, r, c);
    b = this.sortEngine.sortColSpecs(b, r.options.sortBy, r);
    const y = this.buildHeaders(b, r, c), R = r.rows.length > 0 ? this.transformer.groupData(u, [r.rows[0]]) : this.transformer.groupData(u, []);
    let _ = [];
    for (const [T, F] of R) {
      if (T === "__all__" && r.rows.length === 0) {
        _.push(this.buildFlatRow(F, b, r, c, h().engine.grandTotal, 0, T));
        continue;
      }
      const Te = $(T), Ce = this.buildCellsForData(F, b, r, c, T), Ee = r.options.showSubtotals && r.rows.length > 1 ? this.buildSubtotalRow(F, b, r, c, Te, T) : void 0, Fe = r.options.drillDown && r.rows.length > 1 ? this.buildChildRows(F, r, c, b, 1, T) : void 0;
      _.push({
        key: T,
        depth: 0,
        cells: Ce,
        subtotal: Ee,
        isExpanded: !1,
        children: Fe
      });
    }
    _ = this.sortEngine.sortRows(_, r.options.sortBy, r);
    const k = r.options.showColumnTotals && r.columns.length > 0 ? this.buildColumnTotals(u, b, r, c) : void 0, E = r.options.showGrandTotal ? this.buildGrandTotal(u, b, r, c) : void 0, V = {
      headers: y,
      rows: _,
      columnTotals: k,
      grandTotal: E,
      metadata: {
        totalRows: e.length,
        processedRows: i.length,
        executionTime: performance.now() - l,
        warnings: o
      }
    }, be = nt(V, r), we = tt(be, r), _e = ut(we, r), Z = at(_e, r), J = {
      ...Z,
      metadata: {
        ...Z.metadata,
        executionTime: performance.now() - l,
        incremental: p || void 0
      }
    };
    return this.resultCache = { key: w, result: J }, J;
  }
  buildColSpecs(e, t, r) {
    const l = (a) => Qe(a, r);
    if (t.columns.length === 0)
      return t.values.map((a) => ({
        colKey: a.fieldId,
        colParts: [l(a)]
      }));
    const o = this.transformer.getColumnGroups(e, t.columns), s = [];
    for (const [a] of o)
      for (const i of t.values) {
        const u = S(a);
        s.push({
          colKey: `${a}__${i.fieldId}`,
          colParts: [...u, l(i)]
        });
      }
    if (s.length === 0 && t.values.length > 0)
      for (const a of t.values)
        s.push({
          colKey: a.fieldId,
          colParts: [l(a)]
        });
    return s;
  }
  buildHeaders(e, t, r) {
    if (e.length === 0)
      return [];
    const l = {
      key: "__row_label__",
      label: t.rows.length > 0 ? h().engine.group : "",
      colspan: 1,
      rowspan: t.columns.length > 0 ? t.columns.length + 1 : 1,
      depth: 0,
      isValue: !1
    };
    if (t.columns.length === 0)
      return [
        [
          l,
          ...e.map((u, c) => ({
            key: u.colKey,
            label: u.colParts[0] ?? u.colKey,
            colspan: 1,
            rowspan: 1,
            depth: 0,
            isValue: !0
          }))
        ]
      ];
    const o = [], s = t.columns.length, a = t.values.length > 1 || t.columns.length > 0, i = s + (a ? 1 : 0);
    for (let u = 0; u < s; u++) {
      const c = u === 0 ? [l] : [];
      let m = 0;
      for (; m < e.length; ) {
        const d = e[m].colParts[u] ?? "";
        let f = 1;
        for (; m + f < e.length && e[m + f].colParts.slice(0, u + 1).join("|") === e[m].colParts.slice(0, u + 1).join("|"); )
          f++;
        c.push({
          key: `col_${u}_${m}`,
          label: d,
          colspan: f,
          rowspan: 1,
          depth: u,
          isValue: !1
        }), m += f;
      }
      o.push(c);
    }
    return a && o.push([
      ...t.columns.length > 0 ? [] : [
        {
          key: "__row_label__2",
          label: "",
          colspan: 1,
          rowspan: 1,
          depth: s,
          isValue: !1
        }
      ],
      ...e.map((u) => ({
        key: u.colKey,
        label: u.colParts[u.colParts.length - 1] ?? u.colKey,
        colspan: 1,
        rowspan: 1,
        depth: s,
        isValue: !0
      }))
    ]), o.length > 0 && o[0][0] && (o[0][0].rowspan = i), o;
  }
  buildCellsForData(e, t, r, l, o) {
    const s = {
      value: null,
      rawValue: null,
      formatted: "",
      columnKey: "__row_label__",
      isEmpty: !0
    }, a = t.map((i) => this.computeCell(e, i, r, l, o));
    return r.rows.length > 0 ? [s, ...a] : a;
  }
  computeCell(e, t, r, l, o) {
    let s, a = v;
    if (r.columns.length > 0) {
      a = t.colKey.split("__")[0] ?? v;
      const f = t.colKey.split("__").slice(1).join("__");
      s = r.values.find((w) => w.fieldId === f) ?? r.values[0];
    } else
      s = r.values.find((f) => f.fieldId === t.colKey) ?? r.values[0];
    if (!s)
      return {
        value: null,
        rawValue: null,
        formatted: "—",
        columnKey: t.colKey,
        isEmpty: !0
      };
    const i = this.cube.getValues(o, a, s.fieldId), u = i.length > 0 ? i : this.extractNumericValuesFromSubset(e, t, r, s.fieldId), c = l.find((f) => f.id === s.fieldId);
    let m;
    s.aggregation === "CUSTOM" && s.customAggregator ? m = s.customAggregator(u) : m = this.aggregator.aggregate(u, s.aggregation);
    const d = C(m, s.format ?? (c == null ? void 0 : c.format), {
      showCurrency: this.showCurrencySuffix
    });
    return {
      value: m,
      rawValue: m,
      formatted: d,
      columnKey: t.colKey,
      isEmpty: u.length === 0,
      drillContext: {
        rowGroupKey: o,
        colCubeKey: a,
        valueFieldId: s.fieldId
      }
    };
  }
  /** Cube miss bo'lsa fallback (masalan, maxRows kesilgan holat). */
  extractNumericValuesFromSubset(e, t, r, l) {
    let o = e;
    if (r.columns.length > 0) {
      const s = t.colKey.split("__")[0];
      o = e.filter((a) => this.rowMatchesColKey(a, r.columns, s));
    }
    return this.extractNumericValues(o, l);
  }
  rowMatchesColKey(e, t, r) {
    const l = S(r);
    return t.every((o, s) => String(e[o] ?? "N/A") === l[s]);
  }
  extractNumericValues(e, t) {
    return e.map((r) => r[t]).filter((r) => typeof r == "number" && Number.isFinite(r));
  }
  buildFlatRow(e, t, r, l, o, s, a) {
    const i = this.buildCellsForData(e, t, r, l, a);
    return i[0] && (i[0] = {
      ...i[0],
      value: o,
      formatted: o,
      isEmpty: !1
    }), { key: o, depth: s, cells: i };
  }
  buildChildRows(e, t, r, l, o, s) {
    if (o >= t.rows.length)
      return [];
    const a = t.rows[o], i = this.transformer.groupData(e, [a]), u = [];
    for (const [c, m] of i) {
      const d = `${s}${M}${c}`, f = $(c), w = this.buildCellsForData(m, l, t, r, d);
      w[0] && (w[0] = {
        ...w[0],
        value: f,
        formatted: f,
        isEmpty: !1
      });
      const g = o + 1 < t.rows.length ? this.buildChildRows(m, t, r, l, o + 1, d) : void 0;
      u.push({
        key: d,
        depth: o,
        cells: w,
        parentKey: s,
        children: g,
        isExpanded: !1
      });
    }
    return this.sortEngine.sortRows(u, t.options.sortBy, t);
  }
  buildSubtotalRow(e, t, r, l, o, s) {
    const a = this.buildCellsForData(e, t, r, l, s);
    return a[0] && (a[0] = {
      ...a[0],
      value: h().engine.subtotalInline(o),
      formatted: h().engine.subtotalInline(o),
      isEmpty: !1
    }), { label: h().engine.subtotal, cells: a };
  }
  buildColumnTotals(e, t, r, l) {
    const o = this.buildCellsForData(e, t, r, l, "__all__");
    o[0] && (o[0] = {
      ...o[0],
      value: h().engine.columnTotal,
      formatted: h().engine.columnTotal,
      isEmpty: !1,
      drillContext: void 0
    });
    for (const s of o.slice(1))
      s.drillContext = s.drillContext ? { ...s.drillContext, rowGroupKey: "__all__" } : void 0;
    return { label: h().engine.columnTotal, cells: o };
  }
  buildGrandTotal(e, t, r, l) {
    const o = this.buildCellsForData(e, t, r, l, "__all__");
    return o[0] && (o[0] = {
      ...o[0],
      value: h().engine.grandTotal,
      formatted: h().engine.grandTotal,
      isEmpty: !1
    }), { label: h().engine.grandTotal, cells: o };
  }
}
const ct = {
  price: { label: "Narx", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  bonus_line_total: { label: "Bonus summa (qator)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  order_bonus_sum: { label: "Bonuslar summa (buyurtma)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  bonus_qty: { label: "Bonuslar", dataType: "number", format: { type: "number", decimals: 3 } },
  discount_sum: { label: "Chegirma", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  client_balance: { label: "Balans", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  order_debt: { label: "Qarz", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  product_weight_kg: { label: "Og'irlik", dataType: "number", format: { type: "number", decimals: 2 } },
  retail_stock_qty: { label: "Qoldiq (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
  retail_stock_sold_qty: { label: "Sotuv (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
  retail_stock_amount: { label: "Summa (TT)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  client_id: { label: "AKB", dataType: "number", format: { type: "number", decimals: 0 } }
};
[
  ...Object.keys(ct)
];
const mt = new Y();
function dt(n) {
  try {
    const e = mt.compute(n.rawData, n.fields, n.config);
    return { type: "result", id: n.id, result: e };
  } catch (e) {
    const t = e instanceof Error ? e.message : String(e);
    return { type: "error", id: n.id, error: t };
  }
}
self.addEventListener("message", (n) => {
  const e = n.data;
  if (!e || e.type !== "compute") return;
  const t = dt(e);
  self.postMessage(t);
});
//# sourceMappingURL=pivot.worker-CcTtH_KM.js.map
