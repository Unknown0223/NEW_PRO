import { describe, expect, it } from "vitest";
import { isReturnRefundNote, returnRefundNote } from "../src/modules/returns/returns-enhanced.refund-ledger";
import { mapUnionToLedgerRow } from "../src/modules/clients/client-balance-ledger.helpers";
import type { UnionRaw } from "../src/modules/clients/client-balance-ledger.types";
import { Prisma } from "@prisma/client";

describe("return refund ledger", () => {
  it("note helpers", () => {
    expect(returnRefundNote("VR-12")).toBe("Возврат · VR-12");
    expect(isReturnRefundNote("Возврат · VR-12")).toBe(true);
    expect(isReturnRefundNote("Vazvrat: VR-12")).toBe(true);
    expect(isReturnRefundNote("Оплата")).toBe(false);
  });

  it("mapUnionToLedgerRow — refund as Возврат credit", () => {
    const raw: UnionRaw = {
      row_kind: "payment",
      sort_at: new Date("2026-09-11T12:00:00Z"),
      order_id: 161,
      payment_id: 999,
      order_number: null,
      debt_amount: null,
      payment_amount: new Prisma.Decimal(50000),
      payment_type: "balance",
      is_consignment: null,
      agent_name: "Ibroximov",
      expeditor_name: null,
      cash_desk_name: null,
      note: "Возврат · VR-1",
      created_by_login: "admin",
      entry_kind: "refund",
      order_payment_method_ref: null,
      balance_after: null
    };
    const row = mapUnionToLedgerRow(raw);
    expect(row.type_label).toBe("Возврат (999)");
    expect(row.order_kind_label).toBe("Возврат");
    expect(row.payment_amount).toBe("50000");
    expect(row.comment_primary).toBe("Возврат с полки");
  });
});
