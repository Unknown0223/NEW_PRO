import { describe, expect, it } from "vitest";
import { assertUserMatchesSlotType } from "../src/modules/work-slots/work-slots.assign";
import {
  assertFieldStaffBranchScope,
  assertFieldStaffBranchScopeForActor,
  isFieldStaffSingleBranchRole,
  normalizeBranchCode
} from "../src/modules/work-slots/work-slots.branch-scope";
import { clientUpdateTouchesAddress } from "../src/modules/work-slots/work-slots.territory-auto";
import {
  assignUserBodySchema,
  createWorkSlotBodySchema,
  patchLockBodySchema,
  patchWorkSlotBodySchema,
  resolvePendingBodySchema,
  bulkWorkSlotsBodySchema
} from "../src/modules/work-slots/work-slots.schema";

describe("work-slots.assign", () => {
  it("allows agent on agent slot", () => {
    expect(() => assertUserMatchesSlotType("agent", "agent")).not.toThrow();
  });

  it("rejects expeditor on agent slot", () => {
    expect(() => assertUserMatchesSlotType("expeditor", "agent")).toThrow("BAD_SLOT_TYPE");
  });

  it("allows collector on collector slot", () => {
    expect(() => assertUserMatchesSlotType("collector", "collector")).not.toThrow();
  });

  it("rejects agent on skladchik slot", () => {
    expect(() => assertUserMatchesSlotType("agent", "skladchik")).toThrow("BAD_SLOT_TYPE");
  });

  it("allows supervisor on supervisor slot", () => {
    expect(() => assertUserMatchesSlotType("supervisor", "supervisor")).not.toThrow();
  });

  it("allows auditor on auditor slot", () => {
    expect(() => assertUserMatchesSlotType("auditor", "auditor")).not.toThrow();
  });

  it("rejects unknown slot type", () => {
    expect(() => assertUserMatchesSlotType("agent", "operator")).toThrow("BAD_SLOT_TYPE");
  });
});

describe("work-slots.schema", () => {
  it("createWorkSlotBodySchema normalizes required slot_code", () => {
    const parsed = createWorkSlotBodySchema.parse({
      slot_code: "  t-12  ",
      slot_type: "agent"
    });
    expect(parsed.slot_code).toBe("t-12");
    expect(parsed.slot_type).toBe("agent");
  });

  it("patchWorkSlotBodySchema rejects slot_code (immutable Q-01)", () => {
    const result = patchWorkSlotBodySchema.safeParse({
      slot_code: "T-99",
      label: "Yangi"
    });
    expect(result.success).toBe(false);
  });

  it("patchLockBodySchema accepts contract with reason", () => {
    const parsed = patchLockBodySchema.parse({
      lock_type: "contract",
      lock_reason: "Shartnoma #42"
    });
    expect(parsed.lock_type).toBe("contract");
  });

  it("assignUserBodySchema requires positive user_id", () => {
    expect(assignUserBodySchema.safeParse({ user_id: 0 }).success).toBe(false);
    expect(assignUserBodySchema.safeParse({ user_id: 5 }).success).toBe(true);
  });

  it("resolvePendingBodySchema allows null agent_id", () => {
    const parsed = resolvePendingBodySchema.parse({ agent_id: null });
    expect(parsed.agent_id).toBeNull();
  });

  it("bulkWorkSlotsBodySchema requires patch fields", () => {
    expect(bulkWorkSlotsBodySchema.safeParse({ slot_ids: [1] }).success).toBe(false);
    const ok = bulkWorkSlotsBodySchema.safeParse({ slot_ids: [1, 2], is_active: false });
    expect(ok.success).toBe(true);
    const del = bulkWorkSlotsBodySchema.safeParse({ slot_ids: [3], delete: true });
    expect(del.success).toBe(true);
    const sup = bulkWorkSlotsBodySchema.safeParse({ slot_ids: [1], slot_type: "supervisor" });
    expect(sup.success).toBe(true);
    const loc = bulkWorkSlotsBodySchema.safeParse({
      slot_ids: [1, 2],
      territory_zone: "Z1",
      warehouse_id: 3
    });
    expect(loc.success).toBe(true);
    const multi = bulkWorkSlotsBodySchema.safeParse({
      slot_ids: [1, 2, 3],
      branch_codes: ["A", "B"],
      territory_cities: ["T1", "T2"]
    });
    expect(multi.success).toBe(true);
    const ambiguous = bulkWorkSlotsBodySchema.safeParse({
      slot_ids: [1],
      branch_code: "A",
      branch_codes: ["B"]
    });
    expect(ambiguous.success).toBe(false);
  });
});

describe("work-slots.branch-scope", () => {
  it("detects field staff roles", () => {
    expect(isFieldStaffSingleBranchRole("agent")).toBe(true);
    expect(isFieldStaffSingleBranchRole("supervisor")).toBe(false);
  });

  it("normalizes branch codes case-insensitively", () => {
    expect(normalizeBranchCode("  Filial-A ")).toBe("filial-a");
  });

  it("blocks cross-branch order for agent viewer", () => {
    expect(() =>
      assertFieldStaffBranchScope("agent", "Filial-A", "Filial-B")
    ).toThrow("BRANCH_SCOPE_VIOLATION");
  });

  it("allows supervisor cross-branch", () => {
    expect(() =>
      assertFieldStaffBranchScope("supervisor", "Filial-A", "Filial-B")
    ).not.toThrow();
  });

  it("assertFieldStaffBranchScopeForActor no-ops without actor", async () => {
    await expect(
      assertFieldStaffBranchScopeForActor(1, null, [99], ["filial-b"])
    ).resolves.toBeUndefined();
  });
});

describe("work-slots.territory-auto", () => {
  it("clientUpdateTouchesAddress detects region change", () => {
    expect(clientUpdateTouchesAddress({ region: "Toshkent" })).toBe(true);
    expect(clientUpdateTouchesAddress({ name: "Shop" })).toBe(false);
  });
});

describe("work-slots.kpi", () => {
  it("getWorkSlotActivityReport rejects inverted date range", async () => {
    const { getWorkSlotActivityReport } = await import("../src/modules/work-slots/work-slots.kpi");
    await expect(
      getWorkSlotActivityReport(1, {
        date_from: new Date("2026-05-20"),
        date_to: new Date("2026-05-01")
      })
    ).rejects.toThrow("BAD_DATE_RANGE");
  });
});
