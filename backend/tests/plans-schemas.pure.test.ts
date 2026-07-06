import { describe, expect, it } from "vitest";
import {
  directionQuerySchema,
  optionsQuerySchema,
  saveApproverBodySchema
} from "../src/modules/plans/plans.schema";

describe("plans.schema", () => {
  it("directionQuerySchema requires positive direction_id", () => {
    expect(directionQuerySchema.safeParse({ direction_id: "12" }).success).toBe(true);
    expect(directionQuerySchema.safeParse({}).success).toBe(false);
    expect(directionQuerySchema.safeParse({ direction_id: 0 }).success).toBe(false);
  });

  it("optionsQuerySchema allows optional direction_id", () => {
    expect(optionsQuerySchema.safeParse({}).success).toBe(true);
    expect(optionsQuerySchema.safeParse({ direction_id: "3" }).success).toBe(true);
  });

  it("saveApproverBodySchema accepts rows and leaders", () => {
    const r = saveApproverBodySchema.safeParse({
      rows: [{ supervisor_user_id: 1, levels: [2, null] }],
      leaders: [3]
    });
    expect(r.success).toBe(true);
  });

  it("saveApproverBodySchema rejects extra keys", () => {
    expect(
      saveApproverBodySchema.safeParse({
        rows: [],
        leaders: [],
        extra: true
      }).success
    ).toBe(false);
  });
});
