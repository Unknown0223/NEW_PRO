import { describe, expect, it } from "vitest";
import {
  resolveCoverActingAgentId,
  resolveCoverScopeAgentUserId
} from "../src/modules/mobile/cover/cover-guard.pure";

describe("resolveCoverActingAgentId", () => {
  const cover = { agent_user_id: 11, svr_user_id: 22 };

  it("SVR with matching active cover acts as agent", () => {
    expect(
      resolveCoverActingAgentId({
        viewerRole: "supervisor",
        viewerUserId: 22,
        activeCover: cover
      })
    ).toBe(11);
  });

  it("rejects wrong SVR, agent, or missing cover", () => {
    expect(
      resolveCoverActingAgentId({
        viewerRole: "supervisor",
        viewerUserId: 99,
        activeCover: cover
      })
    ).toBeNull();
    expect(
      resolveCoverActingAgentId({
        viewerRole: "agent",
        viewerUserId: 11,
        activeCover: cover
      })
    ).toBeNull();
    expect(
      resolveCoverActingAgentId({
        viewerRole: "supervisor",
        viewerUserId: 22,
        activeCover: null
      })
    ).toBeNull();
  });
});

describe("resolveCoverScopeAgentUserId", () => {
  it("falls back to viewer when not acting via cover", () => {
    expect(
      resolveCoverScopeAgentUserId({
        viewerRole: "agent",
        viewerUserId: 11,
        activeCover: null
      })
    ).toBe(11);
  });

  it("uses covered agent when SVR is covering", () => {
    expect(
      resolveCoverScopeAgentUserId({
        viewerRole: "supervisor",
        viewerUserId: 22,
        activeCover: { agent_user_id: 11, svr_user_id: 22 }
      })
    ).toBe(11);
  });
});
