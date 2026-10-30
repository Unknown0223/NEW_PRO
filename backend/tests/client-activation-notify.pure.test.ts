import { describe, expect, it } from "vitest";
import { clientActivationNotifyRecipientIds } from "../src/modules/notifications/client-activation-notify";
import { newClientActiveFromApprovalFlag } from "../src/modules/mobile/mobile-agent-new-client";

describe("clientActivationNotifyRecipientIds", () => {
  it("includes primary agent and assignment agents", () => {
    expect(
      clientActivationNotifyRecipientIds({
        agent_id: 10,
        assignment_agent_ids: [10, 20, null, 0]
      })
    ).toEqual([10, 20]);
  });

  it("excludes actor who activated", () => {
    expect(
      clientActivationNotifyRecipientIds({
        agent_id: 10,
        assignment_agent_ids: [20],
        actor_user_id: 10
      })
    ).toEqual([20]);
  });

  it("returns empty when only actor", () => {
    expect(
      clientActivationNotifyRecipientIds({
        agent_id: 5,
        actor_user_id: 5
      })
    ).toEqual([]);
  });
});

describe("agent new client active flag", () => {
  it("maps require_new_client_approval to is_active", () => {
    expect(newClientActiveFromApprovalFlag(true)).toBe(true);
    expect(newClientActiveFromApprovalFlag(false)).toBe(false);
    expect(newClientActiveFromApprovalFlag(undefined)).toBe(false);
  });
});
