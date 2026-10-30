import { describe, expect, it } from "vitest";
import { mergeAgentAssignmentPatches } from "../src/modules/clients/clients.agent-assignments.merge";
import { patchClientBodySchema } from "../src/contracts/clients.schemas";

const row = (slot: number, agent_id: number | null, expeditor_user_id: number | null, visit_weekdays: number[]) => ({
  slot,
  agent_id,
  visit_date: null,
  expeditor_phone: null,
  expeditor_user_id,
  visit_weekdays
});

describe("mergeAgentAssignmentPatches", () => {
  it("faqat kunlar yuborilsa agent va ekspeditor saqlanadi", () => {
    const out = mergeAgentAssignmentPatches([row(1, 10, 20, [1])], [{ slot: 1, visit_weekdays: [3, 5] }]);
    expect(out).toEqual([
      { slot: 1, agent_id: 10, visit_date: null, expeditor_phone: null, expeditor_user_id: 20, visit_weekdays: [3, 5] }
    ]);
  });

  it("boshqa slotlar o'chmaydi", () => {
    const out = mergeAgentAssignmentPatches([row(1, 10, null, []), row(2, 11, 21, [2])], [{ slot: 1, expeditor_user_id: 30 }]);
    expect(out.map((s) => [s.slot, s.agent_id, s.expeditor_user_id])).toEqual([
      [1, 10, 30],
      [2, 11, 21]
    ]);
  });

  it("sxema: yuborilmagan agent/ekspeditor undefined qoladi, null — tozalash", () => {
    const parsed = patchClientBodySchema.parse({
      agent_assignments: [{ slot: 1, visit_weekdays: [2] }, { slot: 2, agent_id: null, expeditor_user_id: "7" }],
      agent_assignments_merge: true
    });
    const [s1, s2] = parsed.agent_assignments!;
    expect("agent_id" in s1! ? s1!.agent_id : undefined).toBeUndefined();
    expect(s1!.expeditor_user_id).toBeUndefined();
    expect(s2!.agent_id).toBeNull();
    expect(s2!.expeditor_user_id).toBe(7);
    expect(parsed.agent_assignments_merge).toBe(true);
  });

  it("yangi slot qo'shiladi", () => {
    const out = mergeAgentAssignmentPatches([], [{ slot: 1, agent_id: 9 }]);
    expect(out).toEqual([{ slot: 1, agent_id: 9 }]);
  });
});
