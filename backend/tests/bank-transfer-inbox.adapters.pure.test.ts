import { describe, expect, it } from "vitest";
import {
  BankApiBankTransferAdapter,
  BankTransferAdapterNotConfiguredError,
  FakeBankTransferAdapter,
  OneCBankTransferAdapter,
  StubBankTransferAdapter,
  resolveBankTransferPollAdapter
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.adapters";

describe("bank-transfer-inbox adapters (pure)", () => {
  it("Stub returns empty", async () => {
    const rows = await new StubBankTransferAdapter("bank_api").fetchPending();
    expect(rows).toEqual([]);
  });

  it("Fake returns three sample rows", async () => {
    const rows = await new FakeBankTransferAdapter("bank_api", { runId: "t1" }).fetchPending();
    expect(rows).toHaveLength(3);
    expect(rows[0]?.external_id).toBe("t1-exact");
  });

  it("OneC throws not configured with ONEC_* env names", async () => {
    const adapter = new OneCBankTransferAdapter({});
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.fetchPending()).rejects.toBeInstanceOf(
      BankTransferAdapterNotConfiguredError
    );
    try {
      await adapter.fetchPending();
    } catch (e) {
      expect(e).toBeInstanceOf(BankTransferAdapterNotConfiguredError);
      const err = e as BankTransferAdapterNotConfiguredError;
      expect(err.missingEnv).toContain("ONEC_BASE_URL");
      expect(err.missingEnv).toContain("ONEC_USER");
      expect(err.missingEnv).toContain("ONEC_PASSWORD");
      expect(err.missingEnv).toContain("ONEC_BANK_TRANSFER_PATH");
    }
  });

  it("BankApi throws not configured with BANK_API_* env names", async () => {
    const adapter = new BankApiBankTransferAdapter({});
    expect(adapter.isConfigured()).toBe(false);
    try {
      await adapter.fetchPending();
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BankTransferAdapterNotConfiguredError);
      const err = e as BankTransferAdapterNotConfiguredError;
      expect(err.missingEnv).toEqual(
        expect.arrayContaining([
          "BANK_API_BASE_URL",
          "BANK_API_TOKEN",
          "BANK_API_TRANSFERS_PATH"
        ])
      );
    }
  });

  it("resolveBankTransferPollAdapter modes", () => {
    expect(resolveBankTransferPollAdapter("fake")).toBeInstanceOf(FakeBankTransferAdapter);
    expect(resolveBankTransferPollAdapter("stub")).toBeInstanceOf(StubBankTransferAdapter);
    expect(resolveBankTransferPollAdapter("one_c")).toBeInstanceOf(OneCBankTransferAdapter);
    expect(resolveBankTransferPollAdapter("bank_api")).toBeInstanceOf(BankApiBankTransferAdapter);
  });
});
