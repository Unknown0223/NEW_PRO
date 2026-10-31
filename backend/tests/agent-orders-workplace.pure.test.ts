import { describe, expect, it } from "vitest";
import { readableAgentName, resolveAgentSmartCode } from "../src/modules/reports/agent-orders.workplace";

describe("agent orders workplace code", () => {
  it("uses the workplace smart code when the personal code is empty", () => {
    expect(resolveAgentSmartCode("", { slotCode: "PMBX003", replaced: false })).toBe("PMBX003");
    expect(resolveAgentSmartCode("  ", { slotCode: "PMBX003", replaced: true })).toBe("PMBX003");
  });

  it("keeps a personal code when it is already set", () => {
    expect(resolveAgentSmartCode("PMNAV004", { slotCode: "PMBX003", replaced: true })).toBe("PMNAV004");
  });

  it("builds a readable name when the stored name has no letters", () => {
    expect(readableAgentName({ name: "■", first_name: "Сарвиноз", last_name: "Исмоилова" })).toBe(
      "Сарвиноз Исмоилова"
    );
    expect(readableAgentName({ name: "ИСМОИЛОВА САРВИНОЗ" })).toBe("ИСМОИЛОВА САРВИНОЗ");
  });
});
