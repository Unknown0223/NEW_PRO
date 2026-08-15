import type { PivotStrings } from "./types.js";

export const uz: PivotStrings = {
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
    clearFilters: (count) => `Filtrlarni tozalash (${count})`,
    chartPng: "PNG"
  },
  chart: {
    bar: "Ustun",
    line: "Chiziq",
    pie: "Doira",
    noData: "Grafik uchun ma'lumot yo'q.",
    truncatedCategories: (shown, total) =>
      `Grafikda faqat birinchi ${shown} ta kategoriya ko'rsatiladi (jami ${total}).`,
    largeDatasetWarning: (rows) =>
      `Katta ma'lumot to'plami (${rows.toLocaleString("uz-UZ")}+ qator). Grafik cheklangan ko'rinishda.`,
    exporting: "PNG eksport qilinmoqda…"
  },
  export: {
    largeSourceWarning: (rows) =>
      `Katta ma'lumot to'plami (${rows.toLocaleString("uz-UZ")}+ qator). Eksport biroz vaqt olishi mumkin.`,
    largeExportWarning: (rows) =>
      `Eksport ${rows.toLocaleString("uz-UZ")}+ qatorni o'z ichiga oladi. Jarayon bo'laklarga bo'linadi.`,
    confirmLargeExport: (rows) =>
      `${rows.toLocaleString("uz-UZ")}+ qator eksport qilinadi. Davom etasizmi?`,
    preparing: "Eksport tayyorlanmoqda…",
    writing: "Fayl yozilmoqda…",
    done: "Eksport yakunlandi",
    progress: (processed, total) =>
      `Eksport: ${processed.toLocaleString("uz-UZ")} / ${total.toLocaleString("uz-UZ")} qator`,
    exportingExcel: "Excel eksport qilinmoqda…",
    exportingCsv: "CSV eksport qilinmoqda…",
    exportingPdf: "PDF eksport qilinmoqda…",
    exportingHtml: "HTML eksport qilinmoqda…"
  },
  table: {
    group: "Guruh",
    rowsMeta: (processed, ms, extras) => {
      const tags: string[] = [];
      if (extras?.virtual) tags.push(`virtual (${extras.virtual})`);
      if (extras?.fromCache) tags.push("kesh");
      if (extras?.incremental) tags.push("diff");
      const suffix = tags.length ? ` · ${tags.join(" · ")}` : "";
      return `${processed} qator · ${ms} ms${suffix}`;
    },
    drillThroughHint: "Ikki marta bosing — manba qatorlar",
    expand: "Yoyish",
    collapse: "Yig'ish"
  },
  drillThrough: {
    title: "Manba qatorlar",
    sheetName: "Manba qatorlar",
    noRows: "Qatorlar topilmadi.",
    rowCount: (count) => `${count} ta qator`,
    showing: (shown, total) => `Ko'rsatilgan: ${shown} / ${total}`,
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
    selectedOfTotal: (selected, total) => `${selected} / ${total} tanlangan`,
    selectedCount: (count) => `${count} ta`,
    reportFiltersLabel: "Hisobot filtrlari",
    activeFiltersCount: (count) => `Faol: ${count}`
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
    subtotalInline: (name) => `${name} (oraliq)`,
    columnTotal: "Ustun jami",
    noValueFields: "Qiymat maydonlari tanlanmagan"
  },
  demo: {
    title: "SavdoDesk Pivot Engine",
    subtitle: (rows, worker, computing) =>
      `Mustaqil demo — ${rows} qator mock ma'lumot${worker ? " · Web Worker" : ""}${computing ? " · hisoblanmoqda…" : ""}`,
    workerHint: "Worker test: ?rows=10000 — 10k+ qator Web Worker orqali hisoblanadi.",
    computing: (worker) => `Pivot hisoblanmoqda${worker ? " (worker)" : ""}…`,
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
    datasetTruncated: (cap, total) =>
      `Ko'pi bilan ${cap} qator ko'rsatildi (jami ${total}). Filtrlarni toraytiring yoki «Eksport» (Excel) orqali yuklab oling.`,
    pivotRowsTruncated: (shown, total) =>
      `Pivot jadvalda ${shown} / ${total} qator ko'rsatildi (limit). Filtrlarni toraytiring yoki sxemani o'zgartiring.`,
    computeFailed: (detail) =>
      `Pivot hisoblanmadi${detail ? `: ${detail}` : "."}`,
    largeDatasetHint: (rows) =>
      `Katta to'plam (${rows} qator): hisoblash vaqt olishi mumkin. Interfeys osilib qolmagan — tugashini kuting.`,
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
};
