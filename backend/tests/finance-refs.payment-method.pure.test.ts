import { describe, expect, it } from "vitest";
import {
  parsePaymentMethodEntry,
  paymentMethodsFromUnknown,
  paymentMethodsSyncedWith1c,
  resolveConfiguredBankTransferPaymentType,
  paymentMethodStorageKey
} from "../src/modules/tenant-settings/finance-refs";
import {
  parseTransferChannelFromPaymentNote,
  resolveTransferChannel
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.helpers";

describe("parsePaymentMethodEntry sync_with_1c", () => {
  it("defaults sync_with_1c to false when missing (old settings)", () => {
    const e = parsePaymentMethodEntry({
      id: "pm-1",
      name: "Наличные",
      code: "naqd",
      currency_code: "UZS"
    });
    expect(e).not.toBeNull();
    expect(e!.sync_with_1c).toBe(false);
  });

  it("parses sync_with_1c=true", () => {
    const e = parsePaymentMethodEntry({
      id: "pm-2",
      name: "Перечисление",
      code: "perechislenie",
      currency_code: "UZS",
      sync_with_1c: true
    });
    expect(e!.sync_with_1c).toBe(true);
    expect(paymentMethodStorageKey(e!)).toBe("perechislenie");
  });

  it("ignores non-boolean sync_with_1c", () => {
    const e = parsePaymentMethodEntry({
      id: "pm-3",
      name: "X",
      currency_code: "UZS",
      sync_with_1c: "yes"
    });
    expect(e!.sync_with_1c).toBe(false);
  });
});

describe("resolveConfiguredBankTransferPaymentType", () => {
  it("falls back to bank_transfer when nothing synced", () => {
    const entries = paymentMethodsFromUnknown([
      { id: "a", name: "Naqd", code: "naqd", currency_code: "UZS", active: true }
    ]);
    expect(resolveConfiguredBankTransferPaymentType(entries)).toBe("bank_transfer");
  });

  it("uses first active sync_with_1c by sort_order", () => {
    const entries = paymentMethodsFromUnknown([
      {
        id: "b",
        name: "Перечисление B",
        code: "perech_b",
        currency_code: "UZS",
        sort_order: 20,
        sync_with_1c: true,
        active: true
      },
      {
        id: "a",
        name: "Перечисление A",
        code: "perech_a",
        currency_code: "UZS",
        sort_order: 10,
        sync_with_1c: true,
        active: true
      },
      {
        id: "cash",
        name: "Naqd",
        code: "naqd",
        currency_code: "UZS",
        sort_order: 1,
        sync_with_1c: false,
        active: true
      }
    ]);
    expect(paymentMethodsSyncedWith1c(entries).map((e) => e.code)).toEqual(["perech_a", "perech_b"]);
    expect(resolveConfiguredBankTransferPaymentType(entries)).toBe("perech_a");
  });

  it("skips inactive synced entries", () => {
    const entries = paymentMethodsFromUnknown([
      {
        id: "off",
        name: "Old",
        code: "old_transfer",
        currency_code: "UZS",
        sync_with_1c: true,
        active: false
      },
      {
        id: "on",
        name: "Bank",
        code: "bank_uzs",
        currency_code: "UZS",
        sync_with_1c: true,
        active: true
      }
    ]);
    expect(resolveConfiguredBankTransferPaymentType(entries)).toBe("bank_uzs");
  });

  it("uses name when code is null", () => {
    const entries = paymentMethodsFromUnknown([
      {
        id: "n",
        name: "Оплата перечислением",
        currency_code: "UZS",
        sync_with_1c: true,
        active: true
      }
    ]);
    expect(resolveConfiguredBankTransferPaymentType(entries)).toBe("Оплата перечислением");
  });
});

describe("transfer channel helpers", () => {
  it("resolveTransferChannel maps sources", () => {
    expect(resolveTransferChannel("manual")).toBe("manual");
    expect(resolveTransferChannel("one_c")).toBe("bank_verified");
    expect(resolveTransferChannel("excel")).toBe("bank_verified");
  });

  it("parses channel from payment note", () => {
    const note =
      "[bank_transfer_inbox #12 channel=manual source=manual] Клиент оплатил";
    expect(parseTransferChannelFromPaymentNote(note)).toEqual({
      channel: "manual",
      source: "manual"
    });
    const bankNote =
      "[bank_transfer_inbox #99 channel=bank_verified source=one_c] ext=1C-001";
    expect(parseTransferChannelFromPaymentNote(bankNote)).toEqual({
      channel: "bank_verified",
      source: "one_c"
    });
    expect(parseTransferChannelFromPaymentNote("обычный комментарий")).toBeNull();
  });
});
