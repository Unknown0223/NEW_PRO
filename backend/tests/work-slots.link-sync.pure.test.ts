import { describe, expect, it, vi } from "vitest";

describe("syncUserLinksToWorkSlotTx", () => {
  it("updates targets, kpi group agents, and null route days", async () => {
    const { syncUserLinksToWorkSlotTx } = await import(
      "../src/modules/work-slots/work-slots.link-sync"
    );

    const tx = {
      salesKpiPlanTarget: {
        updateMany: vi.fn(async () => ({ count: 2 }))
      },
      kpiGroup: {
        findMany: vi.fn(async () => [{ id: 10 }, { id: 11 }])
      },
      kpiGroupAgent: {
        updateMany: vi.fn(async () => ({ count: 1 }))
      },
      agentRouteDay: {
        updateMany: vi.fn(async () => ({ count: 3 }))
      }
    };

    await syncUserLinksToWorkSlotTx(tx as never, 1, 42, 99);

    expect(tx.salesKpiPlanTarget.updateMany).toHaveBeenCalledWith({
      where: { tenant_id: 1, user_id: 42 },
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

  it("clears slot on null and skips route fill", async () => {
    const { syncUserLinksToWorkSlotTx } = await import(
      "../src/modules/work-slots/work-slots.link-sync"
    );
    const tx = {
      salesKpiPlanTarget: { updateMany: vi.fn(async () => ({ count: 0 })) },
      kpiGroup: { findMany: vi.fn(async () => []) },
      kpiGroupAgent: { updateMany: vi.fn(async () => ({ count: 0 })) },
      agentRouteDay: { updateMany: vi.fn(async () => ({ count: 0 })) }
    };
    await syncUserLinksToWorkSlotTx(tx as never, 1, 5, null);
    expect(tx.salesKpiPlanTarget.updateMany).toHaveBeenCalledWith({
      where: { tenant_id: 1, user_id: 5 },
      data: { work_slot_id: null }
    });
    expect(tx.agentRouteDay.updateMany).not.toHaveBeenCalled();
  });
});
