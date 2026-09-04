import { describe, expect, it, vi } from "vitest";

describe("work-slots.supervisor-team", () => {
  it("validateSuperviseeAgentSlotIds rejects non-agent slots", async () => {
    const { validateSuperviseeAgentSlotIds } = await import(
      "../src/modules/work-slots/work-slots.supervisor-team"
    );
    const tx = {
      workSlot: {
        findMany: vi.fn(async () => [{ id: 1 }])
      }
    };
    await expect(validateSuperviseeAgentSlotIds(tx as never, 10, [1, 2])).rejects.toThrow(
      "BAD_SUPERVISEE_AGENT_SLOTS"
    );
    expect(tx.workSlot.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 10,
        id: { in: [1, 2] },
        slot_type: "agent",
        deleted_at: null
      },
      select: { id: true }
    });
  });

  it("validateSuperviseeAgentSlotIds dedupes and accepts all agent slots", async () => {
    const { validateSuperviseeAgentSlotIds } = await import(
      "../src/modules/work-slots/work-slots.supervisor-team"
    );
    const tx = {
      workSlot: {
        findMany: vi.fn(async () => [{ id: 1 }, { id: 2 }])
      }
    };
    const ids = await validateSuperviseeAgentSlotIds(tx as never, 10, [1, 2, 1, 0, -3]);
    expect(ids).toEqual([1, 2]);
  });

  it("syncSupervisorTeamToUsers sets supervisor on team occupants and clears others", async () => {
    const { syncSupervisorTeamToUsers } = await import(
      "../src/modules/work-slots/work-slots.supervisor-team"
    );

    const userUpdate = vi.fn(async () => ({}));
    const tx = {
      workSlot: {
        findFirst: vi.fn(async () => ({
          id: 100,
          slot_type: "supervisor",
          supervisee_agent_slot_ids: [11, 12]
        }))
      },
      slotUserLink: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ user_id: 50 }) // SVR occupant
          .mockResolvedValueOnce({
            slot_id: 99,
            slot: { slot_type: "agent" }
          }), // leftover user 77 active on non-team agent slot
        findMany: vi.fn(async () => [
          { slot_id: 11, user_id: 21 },
          { slot_id: 12, user_id: 22 }
        ])
      },
      user: {
        update: userUpdate,
        findMany: vi.fn(async () => [{ id: 77 }])
      }
    };

    await syncSupervisorTeamToUsers(tx as never, 1, 100);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { supervisor_user_id: 50 }
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 22 },
      data: { supervisor_user_id: 50 }
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { supervisor_user_id: null }
    });
  });

  it("findSupervisorSlotsForAgentSlot queries has filter", async () => {
    const { findSupervisorSlotsForAgentSlot } = await import(
      "../src/modules/work-slots/work-slots.supervisor-team"
    );
    const tx = {
      workSlot: {
        findMany: vi.fn(async () => [{ id: 5 }, { id: 6 }])
      }
    };
    const ids = await findSupervisorSlotsForAgentSlot(tx as never, 1, 42);
    expect(ids).toEqual([5, 6]);
    expect(tx.workSlot.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 1,
        slot_type: "supervisor",
        deleted_at: null,
        supervisee_agent_slot_ids: { has: 42 }
      },
      select: { id: true }
    });
  });
});
