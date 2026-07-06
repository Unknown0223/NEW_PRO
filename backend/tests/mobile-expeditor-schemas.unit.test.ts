import { describe, expect, it } from "vitest";
import {
  mobileExpeditorClientLocationBodySchema,
  mobileExpeditorPartialReturnBodySchema,
  mobileExpeditorPaymentBodySchema,
  mobileExpeditorReloadBodySchema
} from "../src/contracts/mobile.schemas";

describe("mobile expeditor schemas", () => {
  it("mobileExpeditorPaymentBodySchema accepts valid payment", () => {
    const r = mobileExpeditorPaymentBodySchema.safeParse({
      payment_type: "cash_uzs",
      amount: 1000
    });
    expect(r.success).toBe(true);
  });

  it("mobileExpeditorPartialReturnBodySchema requires reason", () => {
    expect(mobileExpeditorPartialReturnBodySchema.safeParse({ reason: "defective" }).success).toBe(true);
    expect(mobileExpeditorPartialReturnBodySchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("mobileExpeditorReloadBodySchema allows empty note", () => {
    expect(mobileExpeditorReloadBodySchema.safeParse({}).success).toBe(true);
  });

  it("mobileExpeditorClientLocationBodySchema validates coords", () => {
    expect(
      mobileExpeditorClientLocationBodySchema.safeParse({ latitude: 41.3, longitude: 69.2 }).success
    ).toBe(true);
    expect(
      mobileExpeditorClientLocationBodySchema.safeParse({ latitude: 120, longitude: 69.2 }).success
    ).toBe(false);
  });
});
