import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePivot } from "@/hooks/pivot/usePivot";
import type { PivotField } from "@salec/pivot-engine";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "product", label: "Mahsulot", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

const ROWS = [
  { region: "Toshkent", product: "A", amount: 100 },
  { region: "Toshkent", product: "B", amount: 200 },
  { region: "Samarqand", product: "A", amount: 150 }
];

describe("usePivot smoke", () => {
  it("compute pivot va reorderFields", async () => {
    const { result } = renderHook(() =>
      usePivot(ROWS, FIELDS, {
        useWorker: false,
        initialConfig: {
          rows: ["region"],
          values: [{ fieldId: "amount", aggregation: "SUM" }]
        }
      })
    );

    await waitFor(() => {
      expect(result.current.isComputing).toBe(false);
      expect(result.current.hasData).toBe(true);
    });

    expect(result.current.pivotData?.metadata.processedRows).toBe(3);

    result.current.reorderFields("rows", ["region"]);
    expect(result.current.config.rows).toEqual(["region"]);
  });
});
