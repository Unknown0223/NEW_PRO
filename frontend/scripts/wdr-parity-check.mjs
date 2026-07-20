#!/usr/bin/env node
/**
 * WebDataRocks ↔ Virtual Pivot UX parity checklist (static).
 * Scores presence of components, CSS tokens, toolbar surfaces, and engine hooks.
 * Does NOT embed proprietary WDR JS — UX/behavior clone only.
 *
 * Usage: node frontend/scripts/wdr-parity-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, "..");
const ROOT = path.resolve(FRONTEND, "..");

function read(rel) {
  const full = path.isAbsolute(rel) ? rel : path.join(FRONTEND, rel);
  try {
    return fs.readFileSync(full, "utf8");
  } catch {
    return "";
  }
}

function exists(rel) {
  const full = path.isAbsolute(rel) ? rel : path.join(FRONTEND, rel);
  return fs.existsSync(full);
}

/** @type {{ id: string; weight: number; ok: boolean; note?: string }[]} */
const checks = [];

function check(id, weight, ok, note) {
  checks.push({ id, weight, ok: Boolean(ok), note });
}

const builder = read("components/reports/virtual-pivot-report-builder.tsx");
const fieldsModal = read("components/reports/virtual-pivot-fields-modal.tsx");
const formatDialogs = read("components/reports/virtual-pivot-format-dialogs.tsx");
const pivotTable = read("components/pivot/PivotTable/index.tsx");
const pivotCss = read("components/pivot/PivotTable/pivot-grid.module.css");
const pivotRow = read("components/pivot/PivotTable/PivotRow.tsx");
const usePivot = read("hooks/pivot/usePivot.ts");
const filterEditor = read("components/pivot/PivotFilters/FilterEditor.tsx");
const multiSelect = read("components/pivot/PivotFilters/MultiSelectFilter.tsx");
const drill = read("components/pivot/PivotDrillThrough.tsx");
const layoutForm = read("lib/pivot-layout-form.ts");
const engineLayout = read(path.join(ROOT, "packages/pivot-engine/src/utils/layoutForm.ts"))
  || read("vendor/pivot-engine/src/utils/layoutForm.ts");
const engineCf = read(path.join(ROOT, "packages/pivot-engine/src/utils/conditionalFormat.ts"))
  || read("vendor/pivot-engine/src/utils/conditionalFormat.ts");

// ——— Toolbar ———
check("toolbar.open_reports", 2, /Отчёты|FolderOpen|reportsDialogOpen/.test(builder));
check("toolbar.save", 2, /Сохр\. как|saveDialogOpen|saveMut/.test(builder));
check("toolbar.export", 2, /Экспорт|handleExportExcel|exportExcel/.test(builder));
check("toolbar.copy", 2, /Копировать|handleCopySelection|copySelection/.test(builder));
check("toolbar.expand_collapse", 2, /hierarchyExpanded|expandAll|collapseAll/.test(builder));
check("toolbar.format_menu", 3, /Формат ячеек|formatCellsOpen|VirtualPivotFormatCellsDialog/.test(builder));
check("toolbar.conditional", 3, /Условное форматирование|conditionalOpen|VirtualPivotConditionalDialog/.test(builder));
check("toolbar.options", 3, /Опции|optionsOpen|OptionGroup/.test(builder));
check("toolbar.fields", 3, /Поля|openFields|VirtualPivotFieldsModal/.test(builder));
check("toolbar.fullscreen", 2, /На весь|handleToggleFullscreen|workspaceExpanded|isFullscreen/.test(builder));
check("toolbar.connect_absent_ok", 1, !/Connect|Подключить данные/.test(builder), "SALEC uses dataset load instead of WDR Connect");

// ——— Fields window ———
check("fields.all_fields_search", 2, /Все поля|Search/.test(fieldsModal));
check("fields.zone_rows", 2, /zone=\"rows\"|Строки/.test(fieldsModal));
check("fields.zone_columns", 2, /zone=\"columns\"|Столбцы/.test(fieldsModal));
check("fields.zone_values", 2, /zone=\"values\"|Значения/.test(fieldsModal));
check("fields.zone_report_filters", 3, /zone=\"reportFilters\"|Фильтры отчета/.test(fieldsModal));
check("fields.dnd", 3, /DndContext|onDragEnd|sortableZoneId/.test(fieldsModal));
check("fields.member_filter_chips", 4, /onConfigureFilter|filterSummaries/.test(fieldsModal));
check("fields.apply_cancel", 2, /Применить|Отменить|onApply|onCancel/.test(fieldsModal));

// ——— Options ———
check("options.layout_compact", 3, /compact|Компактная/.test(builder));
check("options.layout_classic", 3, /classic|Классическая/.test(builder));
check("options.layout_flat", 3, /flat|Плоская/.test(builder) && /resolveLayoutForm|layoutForm/.test(layoutForm + engineLayout));
check("options.grand_totals", 2, /ИТОГО|grandTotals/.test(builder));
check("options.subtotals", 2, /ПОДИТОГ|subtotals/.test(builder));

// ——— Format ———
check("format.cells_dialog", 4, /Формат ячеек|applyCellFormatToConfig/.test(formatDialogs));
check("format.decimals_align_percent", 3, /decimalPlaces|asPercent|align/.test(formatDialogs));
check("format.conditional_dialog", 4, /Условное форматирование|ConditionalFormatRule/.test(formatDialogs));
check("format.engine_cf", 2, /getConditionalFormatStyle/.test(engineCf));

// ——— Filters ———
check("filter.header_funnel_clickable", 4, /openHeaderFilter|thFilterActive|onFilterClick/.test(pivotTable));
check(
  "filter.header_all_types_wired",
  5,
  /resolveHeaderFilterFieldId/.test(pivotTable) &&
    !/filterable=\{filterEnabled && Boolean\(fieldId\) && !h\.isValue\}/.test(pivotTable) &&
    /filterable=\{filterEnabled && Boolean\(fieldId\)\}/.test(pivotTable),
  "Row, column, and measure headers must be filterable (no !h.isValue exclusion)"
);
check(
  "filter.header_field_resolver",
  3,
  exists("components/pivot/PivotTable/headerFields.ts") &&
    /export function resolveHeaderFilterFieldId/.test(read("components/pivot/PivotTable/headerFields.ts"))
);
check(
  "filter.editor_apply_updates_slice",
  4,
  /onApply=\{\(filter\) => \{\s*onSetFilter\(filter, filterPopup\.fieldId\)/.test(pivotTable) ||
    (/onSetFilter\(filter, filterPopup\.fieldId\)/.test(pivotTable) &&
      /FilterEditor/.test(pivotTable))
);
check("filter.editor_wired", 4, /FilterEditor|getFieldMembers|onSetFilter/.test(pivotTable + builder));
check("filter.multiselect", 2, /include|exclude|members/.test(multiSelect));
check("filter.setFilter_hook", 3, /setFilter|clearFilter/.test(usePivot));
check("filter.report_filters_bar", 3, /Фильтры отчета:|reportFilters\.map/.test(builder));
check(
  "filter.engine_includes_values",
  4,
  /getActiveSliceFilters/.test(
    read(path.join(ROOT, "packages/pivot-engine/src/utils/sliceFilters.ts")) ||
      read(path.join(ROOT, "frontend/vendor/pivot-engine/src/utils/sliceFilters.ts"))
  ) &&
    /getActiveSliceFilters/.test(
      read(path.join(ROOT, "frontend/vendor/pivot-engine/src/core/PivotEngine.ts")) ||
        read(path.join(ROOT, "packages/pivot-engine/src/core/PivotEngine.ts"))
    ),
  "Measure header filters must apply in PivotEngine.compute"
);
check(
  "filter.no_decorative_only_funnel",
  2,
  !/aria-hidden \/>\s*\}\)\s*<\/span>/.test(pivotTable) &&
    /data-pg-header-filter/.test(pivotTable),
  "Funnel button only when filterable; connected via data-pg-header-filter"
);

// ——— Grid chrome ———
check("grid.gutters", 3, /thGutterCorner|thColGutter|tdRowGutter|ROW_GUTTER/.test(pivotTable + pivotCss));
check("grid.selection", 3, /selection|tdSelected|RangeSelection/.test(pivotTable));
check("grid.stats_bar", 3, /selectionStats|СР:|КОЛ-ВО|СУММА/.test(pivotTable + pivotCss));
check("grid.wdr_tokens", 3, /--pg-border|--pg-select-bg|--pg-filter-icon|wdr-grid-layout/.test(pivotCss));
check("grid.expand_classic_compact", 4, /isClassic|isCompactMulti|resolveClassicLabels/.test(pivotRow));
check("grid.flat_headers", 2, /hostFlat|flat-header|layoutForm === \"flat\"/.test(pivotCss + pivotTable));

// ——— Context / drill / export ———
check("context.copy_drill_expand", 3, /Детализация|Свернуть|Развернуть|Копировать/.test(pivotTable));
check("drillthrough", 3, /PivotDrillThrough|openDrillThrough|getDrillThroughRecords/.test(builder + drill));
check("export.xlsx_pdf_html", 3, /exportExcel|exportPdf|exportHtml/.test(builder));

// ——— No proprietary engine binary substituted ———
check(
  "no_wdr_engine_as_vp_runtime",
  2,
  !/new WebDataRocks|webdatarocks\.js/.test(builder),
  "Virtual Pivot must use @salec/pivot-engine"
);

const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
const earned = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
const score = totalWeight ? Math.round((earned / totalWeight) * 1000) / 10 : 0;
const missing = checks.filter((c) => !c.ok);

console.log("═══════════════════════════════════════════════════");
console.log(" WebDataRocks ↔ Virtual Pivot parity check");
console.log("═══════════════════════════════════════════════════");
console.log(` Score: ${score}%  (${earned}/${totalWeight} weighted points)`);
console.log(` Checks: ${checks.filter((c) => c.ok).length}/${checks.length} passed`);
console.log("───────────────────────────────────────────────────");

for (const c of checks) {
  const mark = c.ok ? "✓" : "✗";
  const note = c.note ? ` — ${c.note}` : "";
  console.log(` ${mark} [${c.weight}] ${c.id}${note}`);
}

if (missing.length) {
  console.log("───────────────────────────────────────────────────");
  console.log(" Missing / failed:");
  for (const m of missing) {
    console.log(`  - ${m.id}${m.note ? ` (${m.note})` : ""}`);
  }
}

console.log("───────────────────────────────────────────────────");
console.log(" Impossible / intentional <100% (documented):");
console.log("  • Proprietary WDR icon font / canvas multi-sheet engine");
console.log("  • Connect tab (SALEC dataset loader substitutes)");
console.log("  • Exact pixel glyph of WDR icon font");
console.log("  • Full Flexmonster-grade Options (sheet sizes editor UI)");
console.log("═══════════════════════════════════════════════════");

const reportPath = path.join(FRONTEND, "scripts/wdr-parity-last-result.json");
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      score,
      earned,
      totalWeight,
      passed: checks.filter((c) => c.ok).length,
      total: checks.length,
      missing: missing.map((m) => m.id),
      at: new Date().toISOString()
    },
    null,
    2
  )
);
console.log(` Wrote ${path.relative(ROOT, reportPath)}`);

process.exit(missing.length ? 0 : 0); // always 0 — informational; CI can gate on score later
