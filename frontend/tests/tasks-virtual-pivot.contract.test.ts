import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("tasks Virtual Pivot contract", () => {
  it("tasks page uses TasksVirtualPivotWorkspace not FlatReportPage", () => {
    const page = readFileSync(join(frontendRoot, "app/(dashboard)/reports/tasks/page.tsx"), "utf8");
    expect(page).toMatch(/TasksVirtualPivotWorkspace/);
    expect(page).not.toMatch(/FlatReportPage/);

    const ws = readFileSync(
      join(frontendRoot, "components/reports/tasks/tasks-virtual-pivot-workspace.tsx"),
      "utf8"
    );
    expect(ws).toMatch(/usePivot/);
    expect(ws).toMatch(/PivotTable/);
    expect(ws).toMatch(/layoutForm:\s*"flat"|buildTasksFlatPivotConfig/);
    expect(ws).toMatch(/\/reports\/tasks\/dataset/);
    expect(ws).toMatch(/TasksPivotToolbar/);
    expect(ws).toMatch(/TasksPivotDialogs|VirtualPivotFieldsModal/);
    expect(ws).toMatch(/usePivotExport/);
  });

  it("tasks toolbar exposes konstruktor chrome actions", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/tasks/tasks-pivot-toolbar.tsx"),
      "utf8"
    );
    expect(src).toMatch(/Экспорт/);
    expect(src).toMatch(/Копировать/);
    expect(src).toMatch(/Поля/);
    expect(src).toMatch(/Формат даты/);
    expect(src).toMatch(/На весь/);
    expect(src).toMatch(/VirtualPivotFormatMenu/);
    expect(src).not.toMatch(/Табличная форма/);
  });

  it("tasks openings match konstruktor chrome", () => {
    const ws = readFileSync(
      join(frontendRoot, "components/reports/tasks/tasks-virtual-pivot-workspace.tsx"),
      "utf8"
    );
    const dialogs = readFileSync(
      join(frontendRoot, "components/reports/tasks/tasks-pivot-dialogs.tsx"),
      "utf8"
    );
    expect(ws).toMatch(/applyTasksLayoutOptions/);
    expect(ws).toMatch(/PivotChart|viewMode/);
    expect(ws).toMatch(/exportChartPng|showExportPng/);
    expect(dialogs).toMatch(/VirtualPivotLayoutOptionsDialog/);
    expect(dialogs).toMatch(/VirtualPivotConditionalDialog/);
    expect(dialogs).toMatch(/Настройки разметки|VirtualPivotLayoutOptionsDialog/);
  });

  it("default flat fields include SalesDoc core columns", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/tasks/tasks-pivot-fields.ts"),
      "utf8"
    );
    expect(src).toMatch(/task_id/);
    expect(src).toMatch(/title/);
    expect(src).toMatch(/client_name/);
    expect(src).toMatch(/status_label/);
    expect(src).toMatch(/layoutForm:\s*"flat"/);
  });

  it("classic builder always sets a COUNT value measure", async () => {
    const { buildTasksClassicPivotConfig } =
      await import("../components/reports/tasks/tasks-pivot-fields");
    const cfg = buildTasksClassicPivotConfig();
    expect(cfg.options.layoutForm).toBe("classic");
    expect(cfg.values.length).toBeGreaterThan(0);
    expect(cfg.values[0]?.aggregation).toBe("COUNT");
    expect(cfg.rows.length).toBeGreaterThan(0);
  });

  it("applyTasksLayoutOptions flat resets SalesDoc flat columns", async () => {
    const { applyTasksLayoutOptions, TASKS_DEFAULT_FLAT_FIELD_IDS } = await import(
      "../components/reports/tasks/tasks-pivot-fields"
    );
    const cfg = applyTasksLayoutOptions(undefined, {
      layoutForm: "flat",
      grandTotals: "none",
      subtotals: "none"
    });
    expect(cfg.options.layoutForm).toBe("flat");
    expect(cfg.rows).toEqual([...TASKS_DEFAULT_FLAT_FIELD_IDS]);
  });

  it("applyTasksLayoutOptions compact keeps COUNT and compact flags", async () => {
    const { applyTasksLayoutOptions } = await import(
      "../components/reports/tasks/tasks-pivot-fields"
    );
    const cfg = applyTasksLayoutOptions(undefined, {
      layoutForm: "compact",
      grandTotals: "both",
      subtotals: "both"
    });
    expect(cfg.options.layoutForm).toBe("compact");
    expect(cfg.options.compactMode).toBe(true);
    expect(cfg.values[0]?.aggregation).toBe("COUNT");
    expect(cfg.options.showGrandTotal).toBe(true);
  });

  it("applyTasksLayoutOptions from compact preserves custom rows", async () => {
    const { applyTasksLayoutOptions, buildTasksClassicPivotConfig } = await import(
      "../components/reports/tasks/tasks-pivot-fields"
    );
    const compact = {
      ...buildTasksClassicPivotConfig(),
      rows: ["priority_label", "status_label"],
      options: {
        ...buildTasksClassicPivotConfig().options,
        layoutForm: "compact" as const,
        compactMode: true
      }
    };
    const next = applyTasksLayoutOptions(compact, {
      layoutForm: "compact",
      grandTotals: "rows",
      subtotals: "none"
    });
    expect(next.rows).toEqual(["priority_label", "status_label"]);
  });

  it("applyTasksLayoutOptions flat keeps filters from previous config", async () => {
    const { applyTasksLayoutOptions, buildTasksFlatPivotConfig } = await import(
      "../components/reports/tasks/tasks-pivot-fields"
    );
    const from = buildTasksFlatPivotConfig({
      filters: [{ fieldId: "status_label", type: "include", values: ["Открыта"] }]
    });
    const next = applyTasksLayoutOptions(from, {
      layoutForm: "flat",
      grandTotals: "both",
      subtotals: "none"
    });
    expect(next.filters).toEqual(from.filters);
    expect(next.options.showGrandTotal).toBe(true);
  });
});

