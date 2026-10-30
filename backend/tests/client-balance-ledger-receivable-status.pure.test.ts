import { describe, expect, it } from "vitest";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../src/modules/orders/order-status";

describe("client balance ledger — qarz faqat delivered", () => {
  it("OUTSTANDING_RECEIVABLE faqat delivered (new/confirmed kirmaydi)", () => {
    expect([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE]).toEqual(["delivered"]);
    expect(ORDER_STATUSES_OUTSTANDING_RECEIVABLE).not.toContain("new");
    expect(ORDER_STATUSES_OUTSTANDING_RECEIVABLE).not.toContain("confirmed");
    expect(ORDER_STATUSES_OUTSTANDING_RECEIVABLE).not.toContain("picking");
    expect(ORDER_STATUSES_OUTSTANDING_RECEIVABLE).not.toContain("delivering");
  });
});
