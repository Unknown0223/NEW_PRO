import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { aggregatePaymentsByDisplayLabel } from "../src/modules/dashboard/dashboard.payment-labels";
import { paymentMethodsFromUnknown } from "../src/modules/tenant-settings/finance-refs";

describe("aggregatePaymentsByDisplayLabel", () => {
  it("merges code aliases into one named row", () => {
    const entries = paymentMethodsFromUnknown([
      { id: "pm-cash", name: "Наличные", code: "001", currency_code: "UZS", active: true }
    ]);
    const rows = aggregatePaymentsByDisplayLabel(
      [
        { payment_type: "001", amount: new Prisma.Decimal("100") },
        { payment_type: "pm-cash", amount: new Prisma.Decimal("50") },
        { payment_type: "Наличные", amount: new Prisma.Decimal("25") }
      ],
      entries
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payment_type).toBe("Наличные");
    expect(rows[0]!.amount).toBe("175");
    expect(rows[0]!.share_pct).toBe(100);
  });
});
