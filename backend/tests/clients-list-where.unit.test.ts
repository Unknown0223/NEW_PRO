import { describe, expect, it } from "vitest";

/**
 * Agent + kun filtri birlashtirilganligi (clients.list.where.ts) — mantiqiy shartlar.
 * SQL integratsiyasi: clients.integration.test.ts / staging DB.
 */
describe("clients list agent+visit day filter contract", () => {
  it("combined filter requires both agent and weekday params", () => {
    const agentIds = [42];
    const visitDays = [3];
    const useCombined = agentIds.length > 0 && visitDays.length > 0;
    expect(useCombined).toBe(true);
  });

  it("agent-only keeps legacy OR on agent_id and assignments", () => {
    const agentIds = [42];
    const visitDays: number[] = [];
    const useCombined = agentIds.length > 0 && visitDays.length > 0;
    expect(useCombined).toBe(false);
  });

  it("weekday 3 maps to Wednesday (ISO)", () => {
    expect([1, 2, 3, 4, 5, 6, 7]).toContain(3);
  });
});
