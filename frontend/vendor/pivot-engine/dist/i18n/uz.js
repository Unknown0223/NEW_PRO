export const uz = {
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
        noData: "Grafik uchun ma'lumot yo'q.",
        truncatedCategories: (shown, total) => `Grafikda faqat birinchi ${shown} ta kategoriya ko'rsatiladi (jami ${total}).`,
        largeDatasetWarning: (rows) => `Katta ma'lumot to'plami (${rows.toLocaleString("uz-UZ")}+ qator). Grafik cheklangan ko'rinishda.`,
        exporting: "PNG eksport qilinmoqda…"
    },
    export: {
        largeSourceWarning: (rows) => `Katta ma'lumot to'plami (${rows.toLocaleString("uz-UZ")}+ qator). Eksport biroz vaqt olishi mumkin.`,
        largeExportWarning: (rows) => `Eksport ${rows.toLocaleString("uz-UZ")}+ qatorni o'z ichiga oladi. Jarayon bo'laklarga bo'linadi.`,
        confirmLargeExport: (rows) => `${rows.toLocaleString("uz-UZ")}+ qator eksport qilinadi. Davom etasizmi?`,
        preparing: "Eksport tayyorlanmoqda…",
        writing: "Fayl yozilmoqda…",
        done: "Eksport yakunlandi",
        progress: (processed, total) => `Eksport: ${processed.toLocaleString("uz-UZ")} / ${total.toLocaleString("uz-UZ")} qator`,
        exportingExcel: "Excel eksport qilinmoqda…",
        exportingPdf: "PDF eksport qilinmoqda…",
        exportingHtml: "HTML eksport qilinmoqda…"
    },
    table: {
        group: "Guruh",
        rowsMeta: (processed, ms, extras) => {
            const tags = [];
            if (extras?.virtual)
                tags.push(`virtual (${extras.virtual})`);
            if (extras?.fromCache)
                tags.push("kesh");
            if (extras?.incremental)
                tags.push("diff");
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
        selectedCount: (count) => `${count} ta`
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
        subtitle: (rows, worker, computing) => `Mustaqil demo — ${rows} qator mock ma'lumot${worker ? " · Web Worker" : ""}${computing ? " · hisoblanmoqda…" : ""}`,
        workerHint: "Worker test: ?rows=10000 — 10k+ qator Web Worker orqali hisoblanadi.",
        computing: (worker) => `Pivot hisoblanmoqda${worker ? " (worker)" : ""}…`,
        addMetric: "Qiymatlar zonasiga metrika qo'shing."
    },
    reportBuilder: {
        title: "Pivot konstruktor",
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
        sliceTemplatesLabel: "Slice shablonlari"
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
