import { describe, expect, it } from "vitest";
import { shouldBlockAgentMutationsWhileCovered } from "../src/modules/mobile/cover/cover-guard.pure";

describe("shouldBlockAgentMutationsWhileCovered", () => {
  it("blocks only when agent has active cover", () => {
    expect(shouldBlockAgentMutationsWhileCovered(true)).toBe(true);
    expect(shouldBlockAgentMutationsWhileCovered(false)).toBe(false);
  });
});
