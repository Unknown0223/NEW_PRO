import { describe, expect, it } from "vitest";
import {
  actorHasUnrestrictedDataScope,
  agentIdsForRestrictedSql,
  buildActorPaymentGrantOr,
  buildOrderAgentScopeWhere,
  buildScopedStaffDirectoryWhere,
  resolveAllowedAgentIdsForActor,
  resolveVisibleStaffIds,
  type ScopedReportActor
} from "../src/modules/access/access-staff-scope";
import { mergeDirectoryAllowedIds, isDirectoryIdAllowed } from "../src/modules/access/access-directory-scope";

describe("resolveVisibleStaffIds — hodim ∪ hudud", () => {
  it("hech narsa belgilanmagan — bo‘sh", () => {
    expect(resolveVisibleStaffIds([], [], [99, 100])).toEqual([]);
    expect(resolveVisibleStaffIds([], [], [])).toEqual([]);
  });

  it("faqat hodimlar — shu hodimlar", () => {
    expect(resolveVisibleStaffIds([10, 11, 10], [], [99])).toEqual([10, 11]);
  });

  it("faqat hudud — hududdagi hodimlar", () => {
    expect(resolveVisibleStaffIds([], [5], [20, 21])).toEqual([20, 21]);
  });

  it("hudud belgilangan lekin hodim yo‘q — bo‘sh", () => {
    expect(resolveVisibleStaffIds([], [5], [])).toEqual([]);
  });

  it("hodim + hudud — faqat kesishma (begonalar yo‘q)", () => {
    expect(resolveVisibleStaffIds([10, 11, 12], [5], [11, 99])).toEqual([11]);
  });
});

describe("resolveAllowedAgentIdsForActor — deny-by-default", () => {
  it("admin — cheklov yo‘q", () => {
    expect(actorHasUnrestrictedDataScope("admin")).toBe(true);
    expect(
      resolveAllowedAgentIdsForActor({ userId: 1, role: "admin", bound_agent_ids: [9] })
    ).toBeNull();
  });

  it("kassir / skladchik — endi to‘liq katalog emas", () => {
    expect(actorHasUnrestrictedDataScope("cashier")).toBe(false);
    expect(
      resolveAllowedAgentIdsForActor({ userId: 2, role: "cashier", bound_agent_ids: [] })
    ).toEqual([]);
    expect(
      resolveAllowedAgentIdsForActor({ userId: 3, role: "skladchik", bound_agent_ids: [8] })
    ).toEqual([8]);
  });

  it("operator bindsiz — bo‘sh", () => {
    expect(
      resolveAllowedAgentIdsForActor({ userId: 4, role: "operator", bound_agent_ids: [] })
    ).toEqual([]);
  });
});

describe("buildOrderAgentScopeWhere — agent ∪ ombor", () => {
  it("kassir bindsiz — hech narsa", () => {
    const actor: ScopedReportActor = { userId: 2, role: "cashier", bound_agent_ids: [] };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({ agent_id: { in: [] } });
  });

  it("ombor menejeri — faqat o‘z ombori", () => {
    const actor: ScopedReportActor = {
      userId: 6,
      role: "warehouse_manager",
      bound_agent_ids: [],
      warehouse_ids: [5]
    };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({ warehouse_id: { in: [5] } });
  });

  it("agent + ombor — OR", () => {
    const actor: ScopedReportActor = {
      userId: 7,
      role: "operator",
      bound_agent_ids: [10],
      warehouse_ids: [5]
    };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({
      OR: [{ agent_id: { in: [10] } }, { warehouse_id: { in: [5] } }]
    });
  });
});

describe("buildScopedStaffDirectoryWhere", () => {
  it("admin — null (to‘liq)", () => {
    expect(buildScopedStaffDirectoryWhere({ userId: 1, role: "admin", bound_staff_ids: [2] })).toBeNull();
  });

  it("operator bindsiz — bo‘sh id", () => {
    expect(
      buildScopedStaffDirectoryWhere({ userId: 3, role: "operator", bound_staff_ids: [] })
    ).toEqual({ id: { in: [] } });
  });

  it("hudud kesishmasi — faqat bound staff", () => {
    expect(
      buildScopedStaffDirectoryWhere({
        userId: 3,
        role: "manager",
        bound_staff_ids: [10, 12]
      })
    ).toEqual({ id: { in: [10, 12] } });
  });
});

describe("buildActorPaymentGrantOr", () => {
  it("kassir faqat kassa", () => {
    const actor: ScopedReportActor = {
      userId: 2,
      role: "cashier",
      bound_agent_ids: [],
      cash_desk_ids: [4]
    };
    expect(buildActorPaymentGrantOr(actor)).toEqual({ cash_desk_id: { in: [4] } });
  });

  it("hech narsa — bo‘sh", () => {
    const actor: ScopedReportActor = { userId: 2, role: "cashier", bound_agent_ids: [], cash_desk_ids: [] };
    expect(buildActorPaymentGrantOr(actor)).toEqual({ id: { in: [] } });
  });
});

describe("directory merge / sentinel", () => {
  it("bo‘sh actor ids — hech narsa", () => {
    expect(mergeDirectoryAllowedIds([], undefined)).toEqual([]);
    expect(isDirectoryIdAllowed([], 1)).toBe(false);
    expect(isDirectoryIdAllowed(null, 1)).toBe(true);
  });

  it("dashboard SQL — bo‘sh IN o‘rniga [0]", () => {
    expect(agentIdsForRestrictedSql([])).toEqual([0]);
    expect(agentIdsForRestrictedSql([10, 11])).toEqual([10, 11]);
  });
});
