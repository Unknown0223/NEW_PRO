import { describe, expect, it } from "vitest";
import { orderBucketsByAmount } from "../src/modules/reports/agent-orders.agent-sql";

describe("orderBucketsByAmount", () => {
  it("puts the larger product column first", () => {
    const matrix = orderBucketsByAmount({
      buckets: ["B", "A"],
      rows: [
        { values: { A: { amount: "10" }, B: { amount: "2" } } },
        { values: { A: { amount: "5" }, B: { amount: "1" } } }
      ]
    });
    expect(matrix.buckets).toEqual(["A", "B"]);
  });
});
