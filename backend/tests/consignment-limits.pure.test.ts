import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { proposeLimitFromPlan, proposeLimitFromSnapshot } from "../src/modules/consignment/consignment-limits.pure";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("proposeLimitFromPlan", () => {
  it("takes the percent of the plan sum", () => {
    expect(proposeLimitFromPlan(D(10_000_000), 30, 1)).toBe("3000000");
  });

  it("rounds half up to the chosen step", () => {
    expect(proposeLimitFromPlan(D(12_345_678), 10, 1000)).toBe("1235000");
    expect(proposeLimitFromPlan(D(12_345_678), 10, 100000)).toBe("1200000");
    expect(proposeLimitFromPlan(D(1_250), 100, 100000)).toBe("0");
  });

  it("gives no proposal without a positive plan or percent", () => {
    expect(proposeLimitFromPlan(null, 30, 1)).toBeNull();
    expect(proposeLimitFromPlan(D(0), 30, 1)).toBeNull();
    expect(proposeLimitFromPlan(D(1000), 0, 1)).toBeNull();
  });
});

describe("proposeLimitFromSnapshot", () => {
  it("returns the stored month limit or nothing for unlimited / missing", () => {
    expect(proposeLimitFromSnapshot(D("5000000.00"))).toBe("5000000");
    expect(proposeLimitFromSnapshot(null)).toBeNull();
  });
});
