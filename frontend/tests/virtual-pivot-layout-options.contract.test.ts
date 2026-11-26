import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("virtual pivot layout options dialog", () => {
  it("exports dialog with Arena Настройки разметки copy", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/virtual-pivot-layout-options-dialog.tsx"),
      "utf8"
    );
    expect(src).toMatch(/export function VirtualPivotLayoutOptionsDialog/);
    expect(src).toMatch(/Настройки разметки/);
    expect(src).toMatch(/Компактная форма/);
    expect(src).toMatch(/Классическая форма/);
    expect(src).toMatch(/Табличная форма/);
    expect(src).toMatch(/Применить/);
    expect(src).toMatch(/Отмена/);
    expect(src).toMatch(/Общий итог/);
    expect(src).toMatch(/Промежуточный итог/);
  });

  it("exports format menu with konstruktor bands", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/virtual-pivot-format-menu.tsx"),
      "utf8"
    );
    expect(src).toMatch(/export function VirtualPivotFormatMenu/);
    expect(src).toMatch(/Dialog/);
    expect(src).toMatch(/Формат ячеек…/);
    expect(src).toMatch(/Условное форматирование…/);
    expect(src).toMatch(/Таблица/);
    expect(src).toMatch(/Диаграмма/);
    expect(src).toMatch(/Итоги по столбцам/);
    expect(src).toMatch(/Намуна|Образец/);
  });

  it("konstruktor builder consumes shared chrome", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/virtual-pivot-report-builder.tsx"),
      "utf8"
    );
    expect(src).toMatch(/VirtualPivotLayoutOptionsDialog/);
    expect(src).toMatch(/VirtualPivotFormatMenu/);
  });
});
