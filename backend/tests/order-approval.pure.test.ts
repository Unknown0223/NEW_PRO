import { describe, expect, it } from "vitest";
import {
  buildApprovalView,
  parseApprovalChain,
  type ApprovalChainStep
} from "../src/modules/orders/order-approval.service";

describe("order-approval.service", () => {
  const chain: ApprovalChainStep[] = [
    { user_id: 10, name: "Supervisor A", role: "supervisor", kind: "level" },
    { user_id: 20, name: "Director", role: "manager", kind: "leader" }
  ];

  it("parseApprovalChain filters invalid entries", () => {
    expect(parseApprovalChain([{ user_id: 5, name: "X", role: "agent", kind: "level" }, null])).toEqual([
      { user_id: 5, name: "X", role: "agent", kind: "level" }
    ]);
  });

  it("buildApprovalView marks current approver and can_advance for admin", () => {
    const view = buildApprovalView("pending", 0, chain, 99, "admin");
    expect(view.current_approver?.user_id).toBe(10);
    expect(view.can_advance).toBe(true);
  });

  it("buildApprovalView allows only matching approver", () => {
    const allowed = buildApprovalView("pending", 0, chain, 10, "supervisor");
    const denied = buildApprovalView("pending", 0, chain, 11, "supervisor");
    expect(allowed.can_advance).toBe(true);
    expect(denied.can_advance).toBe(false);
  });

  it("buildApprovalView step 1 uses second approver", () => {
    const view = buildApprovalView("pending", 1, chain, 20, "manager");
    expect(view.current_approver?.user_id).toBe(20);
    expect(view.can_advance).toBe(true);
  });
});
