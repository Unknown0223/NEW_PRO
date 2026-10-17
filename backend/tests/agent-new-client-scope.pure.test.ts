import { describe, expect, it } from "vitest";
import {
  clientMatchesAgentScopeInput,
  createdClientImmediatelyOrderable,
  newClientActiveFromApprovalFlag
} from "../src/modules/mobile/mobile-agent-new-client";
import { contractLockBlocksOtherAgent } from "../src/modules/work-slots/work-slots.contract-lock";

describe("agent newly created client visibility", () => {
  it("just-created client with agent_id is in the creating agent's list without a weekday plan", () => {
    const created = {
      tenant_id: 7,
      merged_into_client_id: null,
      agent_id: 42,
      assignmentAgentIds: [42],
      assignmentWorkSlotIds: [9]
    };
    expect(clientMatchesAgentScopeInput(created, 7, 42, 9)).toBe(true);
    expect(clientMatchesAgentScopeInput(created, 7, 99, 11)).toBe(false);
  });

  it("agent_id alone is enough even when assignment is empty", () => {
    expect(
      clientMatchesAgentScopeInput(
        {
          tenant_id: 1,
          merged_into_client_id: null,
          agent_id: 5,
          assignmentAgentIds: [],
          assignmentWorkSlotIds: []
        },
        1,
        5,
        null
      )
    ).toBe(true);
  });

  it("is immediately orderable when active and not contract-locked to another agent", () => {
    const inScope = clientMatchesAgentScopeInput(
      {
        tenant_id: 1,
        merged_into_client_id: null,
        agent_id: 5,
        assignmentAgentIds: [5]
      },
      1,
      5,
      3
    );
    const lockBlocks = contractLockBlocksOtherAgent({ lock_type: "none", agent_id: 5 }, 5);
    expect(
      createdClientImmediatelyOrderable({
        is_active: true,
        inAgentScope: inScope,
        contractLockBlocks: lockBlocks
      })
    ).toBe(true);
  });

  it("contract lock on another agent blocks the order, not list membership", () => {
    expect(contractLockBlocksOtherAgent({ lock_type: "contract", agent_id: 8 }, 5)).toBe(true);
    expect(contractLockBlocksOtherAgent({ lock_type: "none", agent_id: 8 }, 5)).toBe(false);
    expect(
      createdClientImmediatelyOrderable({
        is_active: true,
        inAgentScope: true,
        contractLockBlocks: true
      })
    ).toBe(false);
  });

  it("inactive client is not immediately orderable", () => {
    expect(
      createdClientImmediatelyOrderable({
        is_active: false,
        inAgentScope: true,
        contractLockBlocks: false
      })
    ).toBe(false);
  });

  it("is active only when Подтверждение нового клиента is on", () => {
    expect(newClientActiveFromApprovalFlag(true)).toBe(true);
    expect(newClientActiveFromApprovalFlag(false)).toBe(false);
    expect(newClientActiveFromApprovalFlag(undefined)).toBe(false);
  });
});
