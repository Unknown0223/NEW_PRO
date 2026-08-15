import { describe, expect, it } from "vitest";
import {
  buildOrderAgentScopeWhere,
  buildScopedAgentWhere,
  intersectRequestedAgentIds,
  isOrderAgentAllowedForActor,
  resolveAllowedAgentIdsForActor,
  type ScopedReportActor
} from "../src/modules/access/access-agent-scope";

describe("order agent Access scope", () => {
  it("admin — cheklov yo‘q", () => {
    const actor: ScopedReportActor = { userId: 1, role: "admin", bound_agent_ids: [9] };
    expect(buildOrderAgentScopeWhere(actor)).toBeNull();
    expect(isOrderAgentAllowedForActor(99, actor)).toBe(true);
    expect(resolveAllowedAgentIdsForActor(actor)).toBeNull();
  });

  it("operator bog‘langan agentlar — faqat ular", () => {
    const actor: ScopedReportActor = {
      userId: 3,
      role: "operator",
      bound_agent_ids: [10, 11]
    };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({ agent_id: { in: [10, 11] } });
    expect(buildScopedAgentWhere(1, actor)).toMatchObject({ id: { in: [10, 11] } });
    expect(isOrderAgentAllowedForActor(10, actor)).toBe(true);
    expect(isOrderAgentAllowedForActor(99, actor)).toBe(false);
    expect(intersectRequestedAgentIds([10, 99], actor)).toEqual({
      agentIds: [10],
      restricted: true
    });
    expect(intersectRequestedAgentIds([], actor)).toEqual({
      agentIds: [10, 11],
      restricted: true
    });
  });

  it("operator bog‘lanishsiz — bo‘sh ro‘yxat", () => {
    const actor: ScopedReportActor = {
      userId: 3,
      role: "operator",
      bound_agent_ids: []
    };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({ agent_id: { in: [] } });
    expect(buildScopedAgentWhere(1, actor)).toMatchObject({ id: { in: [] } });
    expect(isOrderAgentAllowedForActor(1, actor)).toBe(false);
  });

  it("agent — faqat o‘zi", () => {
    const actor: ScopedReportActor = { userId: 7, role: "agent", bound_agent_ids: [] };
    expect(buildOrderAgentScopeWhere(actor)).toEqual({ agent_id: 7 });
    expect(isOrderAgentAllowedForActor(7, actor)).toBe(true);
    expect(isOrderAgentAllowedForActor(8, actor)).toBe(false);
  });
});
