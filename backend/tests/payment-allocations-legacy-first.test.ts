import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { sortCandidatesLegacyFirst } from "../src/modules/payments/payment-allocations.open";
import type { AllocationCandidateOrder } from "../src/modules/payments/payment-allocations.open";

function cand(
  partial: Partial<AllocationCandidateOrder> & Pick<AllocationCandidateOrder, "id" | "agent_id">
): AllocationCandidateOrder {
  const created = partial.created_at ?? new Date("2026-01-01T00:00:00Z");
  return {
    id: partial.id,
    number: String(partial.id),
    total_sum: new Prisma.Decimal(0),
    merchandise_net: new Prisma.Decimal(100),
    created_at: created,
    consignment_due_date: partial.consignment_due_date ?? null,
    is_consignment: false,
    agent_id: partial.agent_id
  };
}

describe("sortCandidatesLegacyFirst", () => {
  it("puts other-agent orders before current agent", () => {
    const current = 2;
    const sorted = sortCandidatesLegacyFirst(
      [
        cand({ id: 10, agent_id: 2, created_at: new Date("2026-01-01") }),
        cand({ id: 11, agent_id: 1, created_at: new Date("2026-01-02") }),
        cand({ id: 12, agent_id: 2, created_at: new Date("2026-01-03") }),
        cand({ id: 13, agent_id: 1, created_at: new Date("2026-01-01") })
      ],
      current
    );
    expect(sorted.map((o) => o.id)).toEqual([13, 11, 10, 12]);
  });
});
