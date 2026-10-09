import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderCreateAgentLockHint } from "@/components/orders/order-create-agent-lock-hint";

describe("OrderCreateAgentLockHint", () => {
  it("renders contract lock mismatch warning", () => {
    render(
      <OrderCreateAgentLockHint
        assignments={[
          {
            slot: 1,
            agent_id: 5,
            agent_name: "Ali",
            agent_code: "A01",
            lock_type: "contract",
            work_slot_code: "WS-1",
            visit_date: null,
            expeditor_phone: null,
            visit_weekdays: [],
            expeditor_user_id: null,
            expeditor_name: null
          }
        ]}
        selectedAgentId={9}
      />
    );
    expect(screen.getByText(/Блокировка по договору/i)).toBeTruthy();
    expect(screen.getByText(/не совпадает/i)).toBeTruthy();
  });

  it("returns null when no slot-1 assignment", () => {
    const { container } = render(
      <OrderCreateAgentLockHint assignments={[]} selectedAgentId={1} />
    );
    expect(container.firstChild).toBeNull();
  });
});
