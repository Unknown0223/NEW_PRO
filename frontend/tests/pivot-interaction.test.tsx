import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  classicDimClickToggleKey,
  isSortAllowedFromTarget,
  paletteLabelClickAction,
  paletteLabelDoubleClickAction,
  rowLabelClickAction
} from "@/lib/pivot-interaction";
import { PivotRowView } from "@/components/pivot/PivotTable/PivotRow";
import type { PivotConfig, PivotRow } from "@salec/pivot-engine";

afterEach(() => cleanup());

describe("pivot-interaction contracts", () => {
  it("palette: click adds only when unchecked", () => {
    expect(paletteLabelClickAction(false)).toBe("add");
    expect(paletteLabelClickAction(true)).toBe("none");
  });

  it("palette: double-click removes only if already in layout at pointer-down", () => {
    expect(paletteLabelDoubleClickAction(true)).toBe("remove");
    expect(paletteLabelDoubleClickAction(false)).toBe("none");
  });

  it("row label: expand when has children; never sort from body", () => {
    expect(rowLabelClickAction(true)).toBe("toggle-expand");
    expect(rowLabelClickAction(false)).toBe("none");
    expect(isSortAllowedFromTarget("body")).toBe(false);
    expect(isSortAllowedFromTarget("header")).toBe(true);
  });

  it("classic dim click uses path prefix, not leaf rowKey", () => {
    const labels = ["ABUBAKR ZULXUMOR", "SAMARQAND", "SM_SHAHAR"];
    expect(classicDimClickToggleKey(labels, 0, 3, "ABUBAKR ZULXUMOR")).toBe("ABUBAKR ZULXUMOR");
    expect(classicDimClickToggleKey(labels, 1, 3, "SAMARQAND")).toBe(
      "ABUBAKR ZULXUMOR | SAMARQAND"
    );
    expect(classicDimClickToggleKey(labels, 2, 3, "SM_SHAHAR")).toBeNull();
    expect(classicDimClickToggleKey(labels, 0, 3, "")).toBeNull();
  });
});

function pointerClick(el: Element) {
  fireEvent.mouseDown(el, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseUp(el, { button: 0, clientX: 10, clientY: 10 });
}

describe("PivotRowView label click expands (not sort)", () => {
  const config: PivotConfig = {
    rows: ["client_name"],
    columns: [],
    values: [{ fieldId: "amount", aggregation: "sum" }],
    reportFilters: [],
    options: {
      layoutForm: "compact",
      showRowTotals: false,
      showColumnTotals: false,
      showGrandTotals: false
    }
  };

  const row: PivotRow = {
    key: "11 SEKTOR 55 DO'KON",
    cells: [
      {
        columnKey: "__row_label__",
        value: "11 SEKTOR 55 DO'KON",
        formatted: "11 SEKTOR 55 DO'KON",
        rawValue: "11 SEKTOR 55 DO'KON"
      },
      {
        columnKey: "amount",
        value: 100,
        formatted: "100",
        rawValue: 100
      }
    ],
    children: [
      {
        key: "11 SEKTOR 55 DO'KON | Child",
        cells: [
          {
            columnKey: "__row_label__",
            value: "Child",
            formatted: "Child",
            rawValue: "Child"
          }
        ]
      }
    ]
  };

  it("pointer on client name calls onToggle, not onSortLabel", () => {
    const onToggle = vi.fn();
    const onSortLabel = vi.fn();
    render(
      <table>
        <tbody>
          <PivotRowView
            row={row}
            expanded={false}
            onToggle={onToggle}
            onSortLabel={onSortLabel}
            config={config}
            depth={0}
          />
        </tbody>
      </table>
    );

    pointerClick(screen.getByText("11 SEKTOR 55 DO'KON"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSortLabel).not.toHaveBeenCalled();
  });

  it("clicking expand button toggles once (no double fire)", () => {
    const onToggle = vi.fn();
    render(
      <table>
        <tbody>
          <PivotRowView row={row} expanded={false} onToggle={onToggle} config={config} depth={0} />
        </tbody>
      </table>
    );
    const btn = screen.getByRole("button", { name: /Развернуть|Expand|expand/i });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("PivotRowView classic dim expand uses prefix path", () => {
  const config: PivotConfig = {
    rows: ["client_name", "region", "city"],
    columns: [],
    values: [{ fieldId: "order_id", aggregation: "count" }],
    reportFilters: [],
    options: {
      layoutForm: "classic",
      showRowTotals: false,
      showColumnTotals: false,
      showGrandTotals: false
    }
  };

  const leaf: PivotRow = {
    key: "ABUBAKR ZULXUMOR | SAMARQAND | SM_SHAHAR",
    cells: [
      { columnKey: "order_id", value: 1, formatted: "1", rawValue: 1 }
    ]
  };

  it("client / region cells call onTogglePath with prefix keys", () => {
    const onTogglePath = vi.fn();
    const onToggle = vi.fn();
    const expandedRows = new Set([
      "ABUBAKR ZULXUMOR",
      "ABUBAKR ZULXUMOR | SAMARQAND"
    ]);

    render(
      <table>
        <tbody>
          <PivotRowView
            row={leaf}
            expanded={false}
            onToggle={onToggle}
            onTogglePath={onTogglePath}
            expandedRows={expandedRows}
            config={config}
            depth={2}
            pathLabels={["ABUBAKR ZULXUMOR", "SAMARQAND", "SM_SHAHAR"]}
          />
        </tbody>
      </table>
    );

    pointerClick(screen.getByText("ABUBAKR ZULXUMOR"));
    expect(onTogglePath).toHaveBeenCalledWith("ABUBAKR ZULXUMOR");
    expect(onToggle).not.toHaveBeenCalled();

    onTogglePath.mockClear();
    pointerClick(screen.getByText("SAMARQAND"));
    expect(onTogglePath).toHaveBeenCalledWith("ABUBAKR ZULXUMOR | SAMARQAND");
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("classic ExpandToggle collapses via prefix, not leaf rowKey", () => {
    const onTogglePath = vi.fn();
    const onToggle = vi.fn();
    const expandedRows = new Set([
      "ABUBAKR ZULXUMOR",
      "ABUBAKR ZULXUMOR | SAMARQAND"
    ]);

    render(
      <table>
        <tbody>
          <PivotRowView
            row={leaf}
            expanded={false}
            onToggle={onToggle}
            onTogglePath={onTogglePath}
            expandedRows={expandedRows}
            config={config}
            depth={2}
            pathLabels={["ABUBAKR ZULXUMOR", "SAMARQAND", "SM_SHAHAR"]}
          />
        </tbody>
      </table>
    );

    const buttons = screen.getAllByRole("button", { name: /Свернуть|Collapse|collapse/i });
    fireEvent.click(buttons[0]!);
    expect(onTogglePath).toHaveBeenCalledWith("ABUBAKR ZULXUMOR");
    expect(onToggle).not.toHaveBeenCalled();
  });
});
