import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  deltaForPaymentAmountEdit,
  deltaForPostConfirmedPayment,
  deltaForPostExpense,
  deltaForReversePayment,
  isNeverPostedWorkflow
} from "../src/modules/payments/payment-balance.adapters";

const amt = (n: string | number) => new Prisma.Decimal(n);

describe("payment balance adapters (pure sign / pending)", () => {
  it("post confirmed payment and discount_settlement → +amount", () => {
    expect(deltaForPostConfirmedPayment("payment", amt(100))?.toString()).toBe("100");
    expect(deltaForPostConfirmedPayment("discount_settlement", amt("12.5"))?.toString()).toBe(
      "12.5"
    );
    expect(deltaForPostConfirmedPayment(null, amt(1))?.toString()).toBe("1");
  });

  it("post confirmed rejects client_expense (use postExpense)", () => {
    expect(deltaForPostConfirmedPayment("client_expense", amt(50))).toBeNull();
  });

  it("post expense → -amount", () => {
    expect(deltaForPostExpense(amt(80)).toString()).toBe("-80");
  });

  it("reverse payment → -amount; reverse expense → +amount", () => {
    expect(deltaForReversePayment("payment", "confirmed", amt(40))?.toString()).toBe("-40");
    expect(deltaForReversePayment("discount_settlement", "confirmed", amt(40))?.toString()).toBe(
      "-40"
    );
    expect(deltaForReversePayment("client_expense", "confirmed", amt(40))?.toString()).toBe("40");
  });

  it("pending_confirmation / rejected → reverse skip (null)", () => {
    expect(isNeverPostedWorkflow("pending_confirmation")).toBe(true);
    expect(isNeverPostedWorkflow("rejected")).toBe(true);
    expect(isNeverPostedWorkflow("confirmed")).toBe(false);
    expect(deltaForReversePayment("payment", "pending_confirmation", amt(10))).toBeNull();
    expect(deltaForReversePayment("payment", "rejected", amt(10))).toBeNull();
    expect(deltaForReversePayment("client_expense", "pending_confirmation", amt(10))).toBeNull();
  });

  it("amount edit delta matches expense vs payment polarity", () => {
    expect(deltaForPaymentAmountEdit("payment", amt(100), amt(130))?.toString()).toBe("30");
    expect(deltaForPaymentAmountEdit("client_expense", amt(100), amt(130))?.toString()).toBe(
      "-30"
    );
    expect(deltaForPaymentAmountEdit("payment", amt(50), amt(50))).toBeNull();
  });

  it("amount edit on never-posted workflow must be skipped by caller", () => {
    // Guard lives in updatePayment: isNeverPostedWorkflow → no applyDelta.
    expect(isNeverPostedWorkflow("pending_confirmation")).toBe(true);
    expect(isNeverPostedWorkflow("rejected")).toBe(true);
    const edit = deltaForPaymentAmountEdit("payment", amt(10), amt(20));
    expect(edit?.toString()).toBe("10");
    expect(isNeverPostedWorkflow("pending_confirmation") ? null : edit).toBeNull();
  });
});
