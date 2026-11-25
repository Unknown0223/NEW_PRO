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
    expect(ws).toMatch(/VirtualPivotFieldsModal/);
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
    expect(src).toMatch(/Табличная форма/);
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
});

