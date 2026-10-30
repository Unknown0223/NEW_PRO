import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedPivotReportItem } from "@/components/reports/saved-pivot-report-item";

describe("SavedPivotReportItem", () => {
  it("selected + dirty: Сохранить va «изм.» ko‘rinadi", () => {
    const html = renderToStaticMarkup(
      <SavedPivotReportItem
        id={1}
        name="KPI агента"
        selected
        dirty
        onSelect={() => undefined}
        onSave={() => undefined}
        onShare={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(html).toContain("data-selected=\"true\"");
    expect(html).toContain("data-dirty=\"true\"");
    expect(html).toContain("изм.");
    expect(html).toContain("Сохранить");
    expect(html).toContain("Поделиться");
    expect(html).toContain("Удалить");
  });

  it("tanlanmagan: Сохранить/o‘chirish yo‘q", () => {
    const html = renderToStaticMarkup(
      <SavedPivotReportItem
        id={2}
        name="Плоская"
        selected={false}
        onSelect={() => undefined}
        onSave={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(html).toContain("data-selected=\"false\"");
    expect(html).not.toContain("Сохранить");
    expect(html).not.toContain("Удалить");
  });

  it("selected lekin dirty emas: Сохранить disabled", () => {
    const html = renderToStaticMarkup(
      <SavedPivotReportItem
        id={3}
        name="Classic"
        selected
        dirty={false}
        onSelect={() => undefined}
        onSave={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(html).toContain("выбр.");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Нет изменений");
  });
});
