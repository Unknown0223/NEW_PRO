import { describe, expect, it } from "vitest";
import {
  BANK_VERIFIED_SOURCES,
  resolveTransferChannel,
  sourcesForChannel
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.helpers";

describe("bank-transfer-inbox channel helpers", () => {
  it("maps source=manual to channel=manual", () => {
    expect(resolveTransferChannel("manual")).toBe("manual");
  });

  it("maps bank/1C/excel/csv sources to bank_verified", () => {
    for (const s of BANK_VERIFIED_SOURCES) {
      expect(resolveTransferChannel(s)).toBe("bank_verified");
    }
  });

  it("sourcesForChannel returns filter lists", () => {
    expect(sourcesForChannel("manual")).toEqual(["manual"]);
    expect(sourcesForChannel("bank_verified")).toEqual([...BANK_VERIFIED_SOURCES]);
    expect(sourcesForChannel(undefined)).toBeNull();
    expect(sourcesForChannel(null)).toBeNull();
  });

  it("mapInboxRow includes derived channel", async () => {
    const { mapInboxRow } = await import(
      "../src/modules/bank-transfer-inbox/bank-transfer-inbox.helpers"
    );
    const { Prisma } = await import("@prisma/client");
    const base = {
      id: 1,
      status: "pending",
      external_id: null,
      amount: new Prisma.Decimal(100),
      currency: "UZS",
      paid_at: null,
      payer_name: null,
      payer_inn: null,
      payer_pinfl: null,
      payer_bank_account: null,
      payer_bank_mfo: null,
      payer_client_code: null,
      purpose: null,
      match_field: null,
      matched_client_id: null,
      assigned_client_id: null,
      payment_id: null,
      cash_desk_id: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z")
    };
    expect(mapInboxRow({ ...base, source: "manual" }).channel).toBe("manual");
    expect(mapInboxRow({ ...base, source: "excel" }).channel).toBe("bank_verified");
    expect(mapInboxRow({ ...base, source: "one_c" }).channel).toBe("bank_verified");
  });
});
