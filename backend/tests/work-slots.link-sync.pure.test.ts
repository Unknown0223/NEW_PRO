import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockTx() {
  return {
    tenant: { findUnique: vi.fn(async () => ({ settings: { timezone: "Asia/Tashkent" } })) },
    salesKpiPlanTarget: { updateMany: vi.fn(async () => ({ count: 2 })) },
    kpiGroup: { findMany: vi.fn(async () => [{ id: 10 }, { id: 11 }]) },
    kpiGroupAgent: { updateMany: vi.fn(async () => ({ count: 1 })) },
    agentRouteDay: { updateMany: vi.fn(async () => ({ count: 3 })) }
  };
}

describe("syncUserLinksToWorkSlotTx", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("assign: current and future month targets, kpi group agents, null route days", async () => {
    const { syncUserLinksToWorkSlotTx } = await import("../src/modules/work-slots/work-slots.link-sync");
    const tx = mockTx();

    await syncUserLinksToWorkSlotTx(tx as never, 1, 42, 99);

    expect(tx.salesKpiPlanTarget.updateMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 1,
        user_id: 42,
        plan: { OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gte: 9 } }] }
      },
      data: { work_slot_id: 99 }
    });
    expect(tx.kpiGroupAgent.updateMany).toHaveBeenCalledWith({
      where: { user_id: 42, kpi_group_id: { in: [10, 11] } },
      data: { work_slot_id: 99 }
    });
    expect(tx.agentRouteDay.updateMany).toHaveBeenCalledWith({
      where: { tenant_id: 1, agent_id: 42, work_slot_id: null },
      data: { work_slot_id: 99 }
    });
  });

  it("unassign: only future month targets cleared, past and current kept", async () => {
    const { syncUserLinksToWorkSlotTx } = await import("../src/modules/work-slots/work-slots.link-sync");
    const tx = mockTx();
    tx.kpiGroup.findMany = vi.fn(async () => []);

    await syncUserLinksToWorkSlotTx(tx as never, 1, 5, null);

    expect(tx.salesKpiPlanTarget.updateMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 1,
        user_id: 5,
        plan: { OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gt: 9 } }] }
      },
      data: { work_slot_id: null }
    });
    expect(tx.agentRouteDay.updateMany).not.toHaveBeenCalled();
  });
});
