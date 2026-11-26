import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { flattenConfigZones } from "@/lib/pivot-flat-layout";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import type { LayoutOptionsSelection } from "@/components/reports/virtual-pivot-layout-options-dialog";

export type { LayoutOptionsSelection };

/** SalesDoc tasksReport flat default column order. */
export const TASKS_DEFAULT_FLAT_FIELD_IDS = [
  "task_id",
  "title",
  "client_name",
  "created_by_name",
  "assignee_name",
  "status_label",
  "description",
  "result_comment",
  "photo_count",
  "task_type",
  "priority_label",
  "created_at",
  "due_at",
  "completed_at"
] as const;

export const TASKS_PIVOT_FIELDS: PivotField[] = [
  { id: "task_id", label: "ID ЗАДАЧИ", dataType: "number" },
  { id: "title", label: "ЗАДАЧА", dataType: "string" },
  { id: "client_name", label: "КЛИЕНТ", dataType: "string" },
  { id: "created_by_name", label: "НАЗНАЧАЮЩИЙ", dataType: "string" },
  { id: "assignee_name", label: "ИСПОЛНИТЕЛЬ", dataType: "string" },
  { id: "status_label", label: "СТАТУС", dataType: "string" },
  { id: "description", label: "КОММЕНТАРИЙ", dataType: "string" },
  { id: "result_comment", label: "ПРИМЕЧАНИЕ", dataType: "string" },
  { id: "photo_count", label: "ФОТО", dataType: "number" },
  { id: "task_type", label: "ТИП ЗАДАЧИ", dataType: "string" },
  { id: "priority_label", label: "ПРИОРИТЕТ", dataType: "string" },
  { id: "created_at", label: "ДАТА СОЗДАНИЯ", dataType: "date" },
  { id: "due_at", label: "СРОК", dataType: "date" },
  { id: "completed_at", label: "ЗАВЕРШЕНА", dataType: "date" }
];

export function buildTasksFlatPivotConfig(base?: Partial<PivotConfig>): PivotConfig {
  const available = new Set(TASKS_PIVOT_FIELDS.map((f) => f.id));
  const rows = TASKS_DEFAULT_FLAT_FIELD_IDS.filter((id) => available.has(id));
  return flattenConfigZones({
    rows,
    columns: [],
    values: [],
    reportFilters: [],
    filters: [],
    options: {
      showGrandTotal: false,
      showSubtotals: false,
      showColumnTotals: false,
      compactMode: false,
      layoutForm: "flat",
      drillDown: false
    },
    ...base
  });
}

export function selectionFromConfig(config: PivotConfig): LayoutOptionsSelection {
  const layout = resolveLayoutForm(config.options);
  return {
    layoutForm: layout,
    grandTotals:
      !config.options.showGrandTotal && !config.options.showColumnTotals
        ? "none"
        : config.options.showGrandTotal && config.options.showColumnTotals
          ? "both"
          : config.options.showColumnTotals && !config.options.showGrandTotal
            ? "columns"
            : "rows",
    subtotals: !config.options.showSubtotals
      ? "none"
      : config.options.subtotalScope === "rows"
        ? "rows"
        : config.options.subtotalScope === "columns"
          ? "columns"
          : "both"
  };
}

function totalsFromSelection(sel: LayoutOptionsSelection) {
  return {
    showGrandTotal: sel.grandTotals === "both" || sel.grandTotals === "rows",
    showColumnTotals: sel.grandTotals === "both" || sel.grandTotals === "columns",
    showSubtotals: sel.subtotals !== "none",
    subtotalScope: (sel.subtotals === "none" ? "both" : sel.subtotals) as
      | "both"
      | "rows"
      | "columns"
  };
}

/** Tasks Apply path 2: zones from flat/classic builders; compact = classic + flags. */
export function applyTasksLayoutOptions(
  from: PivotConfig | undefined,
  sel: LayoutOptionsSelection
): PivotConfig {
  const totals = totalsFromSelection(sel);
  if (sel.layoutForm === "flat") {
    const flat = buildTasksFlatPivotConfig({
      filters: from?.filters ?? [],
      reportFilters: from?.reportFilters ?? [],
      calculatedMeasures: from?.calculatedMeasures
    });
    // flattenConfigZones forces totals off — re-apply dialog selection
    return {
      ...flat,
      options: {
        ...flat.options,
        ...totals,
        compactMode: false,
        layoutForm: "flat",
        drillDown: false
      }
    };
  }
  const classic = buildTasksClassicPivotConfig(from);
  return {
    ...classic,
    options: {
      ...classic.options,
      ...totals,
      layoutForm: sel.layoutForm,
      compactMode: sel.layoutForm === "compact",
      drillDown: classic.options.drillDown ?? true
    }
  };
}

/** Classic needs ≥1 value measure — otherwise PivotEngine returns empty. */
export function buildTasksClassicPivotConfig(from?: PivotConfig): PivotConfig {
  const available = new Set(TASKS_PIVOT_FIELDS.map((f) => f.id));
  const preferRows = ["status_label", "assignee_name", "task_type"].filter((id) =>
    available.has(id)
  );
  const fromLayout = from ? resolveLayoutForm(from.options) : null;
  const keepRows = fromLayout === "classic" || fromLayout === "compact";
  const baseRows =
    from && keepRows && from.rows.length
      ? from.rows.filter((id) => available.has(id))
      : preferRows;
  const values =
    from?.values?.length && from.values.some((v) => available.has(v.fieldId))
      ? from.values
      : [{ fieldId: "task_id", aggregation: "COUNT" as const, label: "Задач" }];

  return {
    rows: baseRows.length ? baseRows : preferRows,
    columns: from?.columns?.filter((id) => available.has(id)) ?? [],
    values,
    reportFilters: from?.reportFilters ?? [],
    filters: from?.filters ?? [],
    calculatedMeasures: from?.calculatedMeasures,
    options: {
      ...(from?.options ?? {}),
      layoutForm: "classic",
      compactMode: false,
      drillDown: from?.options?.drillDown ?? true,
      showGrandTotal: true,
      showSubtotals: true,
      showColumnTotals: true
    }
  };
}
