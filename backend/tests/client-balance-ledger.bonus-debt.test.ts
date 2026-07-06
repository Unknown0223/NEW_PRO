import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mapUnionToLedgerRow } from "../src/modules/clients/client-balance-ledger.helpers";
import type { UnionRaw } from "../src/modules/clients/client-balance-ledger.types";

function paymentRow(note: string): UnionRaw {
  return {
    row_kind: "payment",
    sort_at: new Date("2026-06-01T10:00:00Z"),
    order_id: null,
    payment_id: 99,
    order_number: null,
    debt_amount: null,
    payment_amount: new Prisma.Decimal(15000),
    payment_type: "balance",
    is_consignment: false,
    agent_name: null,
    expeditor_name: null,
    cash_desk_name: null,
    note,
    created_by_login: "admin",
    entry_kind: "client_expense",
    order_payment_method_ref: null
  };
}

describe("client balance ledger — Долг бонус", () => {
  it("maps bonus debt payment to type_label «Долг бонус»", () => {
    const row = mapUnionToLedgerRow(paymentRow("Долг бонус · VR-42"));
    expect(row.type_label).toBe("Долг бонус");
    expect(row.comment_primary).toBe("Долг бонус (возврат с полки)");
    expect(row.operation_type_code).toBe("2");
  });

  it("plain client_expense stays «Расход»", () => {
    const row = mapUnionToLedgerRow(paymentRow("Обычный расход"));
    expect(row.type_label).toBe("Расход (99)");
    expect(row.comment_primary).toBe("Расход клиента");
  });
});
