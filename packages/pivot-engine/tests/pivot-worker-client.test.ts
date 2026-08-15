import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import { handlePivotWorkerRequest } from "../src/worker/handleCompute.js";
import { createPivotWorkerClient } from "../src/worker/createPivotWorkerClient.js";
import type { PivotField } from "../src/types/pivot.types.js";
import { generate10kRows } from "./fixtures/generate-10k.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "product", label: "Mahsulot", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" },
  { id: "qty", label: "Miqdor", dataType: "number" }
];

describe("pivot worker client", () => {
  it("handlePivotWorkerRequest — 10k qator hisoblaydi", () => {
    const data = generate10kRows();
    const config = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" as const }]
    };

    const response = handlePivotWorkerRequest({
      type: "compute",
      id: "test-1",
      rawData: data,
      fields: FIELDS,
      config
    });

    expect(response.type).toBe("result");
    if (response.type === "result") {
      expect(response.result.metadata.processedRows).toBe(10_000);
      expect(response.result.rows.length).toBeGreaterThan(0);
    }
  });

  it("createPivotWorkerClient — mock worker orqali compute", async () => {
    const engine = new PivotEngine();
    const data = [{ region: "A", amount: 100 }];
    const config = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" as const }]
    };

    const mockWorker = {
      addEventListener: (type: string, handler: (e: MessageEvent) => void) => {
        if (type === "message") {
          (mockWorker as { _handler?: (e: MessageEvent) => void })._handler = handler;
        }
      },
      removeEventListener: () => {},
      postMessage: (msg: { id: string }) => {
        const result = engine.compute(data, FIELDS.slice(0, 2), config);
        const handler = (mockWorker as { _handler?: (e: MessageEvent) => void })._handler;
        handler?.({ data: { type: "result", id: msg.id, result } } as MessageEvent);
      },
      terminate: () => {}
    } as unknown as Worker;

    const client = createPivotWorkerClient({
      threshold: 0,
      workerFactory: () => mockWorker
    });

    expect(client.shouldUseWorker(1)).toBe(true);
    const result = await client.compute(data, FIELDS.slice(0, 2), config);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
