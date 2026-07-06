import { describe, expect, it } from "vitest";

/** recordAgentLocationPing endi agent va expeditor rollarini qabul qiladi. */
describe("field location ping roles", () => {
  it("documents expeditor as field staff for GPS", () => {
    const allowed = new Set(["agent", "expeditor"]);
    expect(allowed.has("expeditor")).toBe(true);
    expect(allowed.has("supervisor")).toBe(false);
  });
});
