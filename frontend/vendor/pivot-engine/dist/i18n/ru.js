export const ru = {
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
        pdf: "PDF",
        html: "HTML",
        fullscreen: "Полный экран",
        exitFullscreen: "Свернуть",
        expandAll: "Развернуть всё",
        collapseAll: "Свернуть всё",
        reset: "Сбросить",
        resetConfig: "Сбросить конфигурацию",
        columnTotals: "Итог по столбцам",
        clearFilters: (count) => `Очистить фильтры (${count})`,
        chartPng: "PNG"
    },
    chart: {
        bar: "Столбцы",
        line: "Линия",
        noData: "Нет данных для графика.",
        truncatedCategories: (shown, total) => `На графике показаны только первые ${shown} категорий (всего ${total}).`,
        largeDatasetWarning: (rows) => `Большой набор данных (${rows.toLocaleString("ru-RU")}+ строк). График в ограниченном виде.`,
        exporting: "Экспорт PNG…"
    },
    export: {
        largeSourceWarning: (rows) => `Большой набор данных (${rows.toLocaleString("ru-RU")}+ строк). Экспорт может занять время.`,
        largeExportWarning: (rows) => `Экспорт включает ${rows.toLocaleString("ru-RU")}+ строк. Процесс будет разбит на части.`,
        confirmLargeExport: (rows) => `Будет экспортировано ${rows.toLocaleString("ru-RU")}+ строк. Продолжить?`,
        preparing: "Подготовка экспорта…",
        writing: "Запись файла…",
        done: "Экспорт завершён",
        progress: (processed, total) => `Экспорт: ${processed.toLocaleString("ru-RU")} / ${total.toLocaleString("ru-RU")} строк`,
        exportingExcel: "Экспорт Excel…",
        exportingPdf: "Экспорт PDF…",
        exportingHtml: "Экспорт HTML…"
    },
    table: {
        group: "Группа",
        rowsMeta: (processed, ms, extras) => {
            const tags = [];
            if (extras?.virtual)
                tags.push(`virtual (${extras.virtual})`);
            if (extras?.fromCache)
                tags.push("кеш");
            if (extras?.incremental)
                tags.push("diff");
            const suffix = tags.length ? ` · ${tags.join(" · ")}` : "";
            return `${processed} строк · ${ms} мс${suffix}`;
        },
        drillThroughHint: "Двойной щелчок — исходные записи",
        expand: "Развернуть",
        collapse: "Свернуть"
    },
    drillThrough: {
        title: "Исходные записи",
        sheetName: "Исходные записи",
        noRows: "Записи не найдены.",
        rowCount: (count) => `${count} строк`,
        showing: (shown, total) => `Показано: ${shown} / ${total}`,
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
        selectedCount: (count) => `${count}`
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
        subtotalInline: (name) => `${name} (пром.)`,
        columnTotal: "Итог по столбцам",
        noValueFields: "Не выбраны поля значений"
    },
    demo: {
        title: "SavdoDesk Pivot Engine",
        subtitle: (rows, worker, computing) => `Автономная демо — ${rows} строк тестовых данных${worker ? " · Web Worker" : ""}${computing ? " · вычисляется…" : ""}`,
        workerHint: "Тест worker: ?rows=10000 — 10k+ строк вычисляются через Web Worker.",
        computing: (worker) => `Вычисление сводной таблицы${worker ? " (worker)" : ""}…`,
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
        sliceTemplatesLabel: "Шаблоны среза"
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
};
