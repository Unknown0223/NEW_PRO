import { describe, expect, it } from "vitest";
import {
  CubeStore,
  hashAggregationConfig,
  hashPivotData,
  isAppendOnlyDataUpdate
} from "../src/core/CubeStore.js";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

const ROWS = [
  { region: "A", amount: 100 },
  { region: "B", amount: 200 }
];

describe("CubeStore", () => {
  it("bir xil data+config — keshdan foydalanadi", () => {
    const engine = new PivotEngine();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };

    engine.compute(ROWS, FIELDS, config);
    expect(engine.cubeCacheSize).toBe(1);

    engine.compute(ROWS, FIELDS, config);
    expect(engine.cubeCacheSize).toBe(1);

    const dataHash = hashPivotData(ROWS);
    const configHash = hashAggregationConfig(config);
    const store = new CubeStore();
    expect(store.get(dataHash, configHash)).toBeUndefined();
  });

  it("bir xil data+config — to'liq natija keshi (fromCache)", () => {
    const engine = new PivotEngine();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };

    const first = engine.compute(ROWS, FIELDS, config);
    expect(first.metadata.fromCache).toBeUndefined();

    const second = engine.compute(ROWS, FIELDS, config);
    expect(second.metadata.fromCache).toBe(true);
    expect(second.rows).toEqual(first.rows);
  });

  it("append-only yangilanish — incremental diff", () => {
    const engine = new PivotEngine();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };

    const base = [...ROWS];
    const full = engine.compute(base, FIELDS, config);
    expect(full.metadata.incremental).toBeUndefined();

    const extended = [...base, { region: "C", amount: 300 }];
    expect(isAppendOnlyDataUpdate(base, extended)).toBe(true);

    const incremental = engine.compute(extended, FIELDS, config);
    expect(incremental.metadata.incremental).toBe(true);
    expect(incremental.rows.some((r) => r.key.includes("C"))).toBe(true);

    const fullRebuild = new PivotEngine().compute(extended, FIELDS, config);
    expect(incremental.rows.length).toBe(fullRebuild.rows.length);
  });

  it("sort o'zgarsa — cube keshi qayta ishlatiladi", () => {
    const engine = new PivotEngine();
    const base: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };

    engine.compute(ROWS, FIELDS, base);
    expect(engine.cubeCacheSize).toBe(1);

    const sorted: PivotConfig = {
      ...base,
      options: { ...base.options, sortBy: { fieldId: "region", direction: "desc" } }
    };
    const r1 = engine.compute(ROWS, FIELDS, sorted);
    expect(engine.cubeCacheSize).toBe(1);
    expect(r1.rows[0]?.key).toContain("B");
  });
});
