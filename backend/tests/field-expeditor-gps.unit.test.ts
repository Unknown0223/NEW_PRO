import { describe, expect, it } from "vitest";

/** recordAgentLocationPing / visit check-in: agent va expeditor o‘z yozuvlari. */
describe("field location ping roles", () => {
  it("documents expeditor as field staff for GPS", () => {
    const allowed = new Set(["agent", "expeditor"]);
    expect(allowed.has("expeditor")).toBe(true);
    expect(allowed.has("supervisor")).toBe(false);
  });

  it("self field check-in skips Dostup agent-scope for agent and expeditor", () => {
    const shouldSkipScope = (role: string, agentId: number, selfId: number | null) =>
      (role === "agent" || role === "expeditor") && agentId === selfId;

    expect(shouldSkipScope("expeditor", 55, 55)).toBe(true);
    expect(shouldSkipScope("agent", 7, 7)).toBe(true);
    expect(shouldSkipScope("expeditor", 55, 99)).toBe(false);
    expect(shouldSkipScope("operator", 10, 10)).toBe(false);
  });
});
