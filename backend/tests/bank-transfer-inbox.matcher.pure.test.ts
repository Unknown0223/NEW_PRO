import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  matchBankTransferPayer,
  type MatcherClientRow
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.matcher";
import {
  parseBankTransferCsv,
  parseBankTransferObjectRows,
  parseBankTransferXlsx,
  parseBankTransferXlsxBase64
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.import";

const clients: MatcherClientRow[] = [
  {
    id: 1,
    warehouse_id: 10,
    bank_account: "20208000900123456789",
    inn: "305123456",
    client_pinfl: null,
    client_code: "C-001",
    is_active: true
  },
  {
    id: 2,
    warehouse_id: 20,
    bank_account: null,
    inn: "305123456",
    client_pinfl: null,
    client_code: "C-002",
    is_active: true
  },
  {
    id: 3,
    warehouse_id: 10,
    bank_account: null,
    inn: null,
    client_pinfl: "12345678901234",
    client_code: "C-003",
    is_active: true
  },
  {
    id: 4,
    warehouse_id: null,
    bank_account: null,
    inn: null,
    client_pinfl: null,
    client_code: "C-004",
    is_active: false
  }
];

describe("matchBankTransferPayer", () => {
  it("matches by bank_account with highest priority", () => {
    const r = matchBankTransferPayer(
      {
        payer_bank_account: "20208 000 9001 2345 6789",
        payer_inn: "305123456",
        payer_name: "Wrong Name LLC"
      },
      clients
    );
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.matched_client_id).toBe(1);
      expect(r.match_field).toBe("bank_account");
    }
  });

  it("never auto-matches by name alone", () => {
    const r = matchBankTransferPayer({ payer_name: "Asosiy mijoz" }, clients);
    expect(r.status).toBe("unmatched");
  });

  it("marks duplicate INN as ambiguous", () => {
    const r = matchBankTransferPayer({ payer_inn: "305123456" }, clients);
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") {
      expect(r.candidates.map((c) => c.client_id).sort()).toEqual([1, 2]);
    }
  });

  it("matches unique pinfl", () => {
    const r = matchBankTransferPayer({ payer_pinfl: "12345678901234" }, clients);
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.matched_client_id).toBe(3);
      expect(r.match_field).toBe("pinfl");
    }
  });

  it("matches client_code when higher fields empty", () => {
    const r = matchBankTransferPayer({ payer_client_code: "C-001" }, clients);
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.matched_client_id).toBe(1);
      expect(r.match_field).toBe("client_code");
    }
  });

  it("ignores inactive clients", () => {
    const r = matchBankTransferPayer({ payer_client_code: "C-004" }, clients);
    expect(r.status).toBe("unmatched");
  });

  it("cross-filial same account → ambiguous", () => {
    const dupAccount: MatcherClientRow[] = [
      { ...clients[0]!, id: 11, warehouse_id: 1 },
      { ...clients[0]!, id: 12, warehouse_id: 2 }
    ];
    const r = matchBankTransferPayer(
      { payer_bank_account: "20208000900123456789" },
      dupAccount
    );
    expect(r.status).toBe("ambiguous");
  });
});

describe("parseBankTransferCsv", () => {
  it("parses semicolon CSV with russian headers", () => {
    const csv = ["сумма;инн;плательщик;дата", "150000,50;305123456;ООО Test;2026-08-01"].join(
      "\n"
    );
    const r = parseBankTransferCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.amount).toBe(150000.5);
    expect(r.items[0]!.payer_inn).toBe("305123456");
  });

  it("reports bad amount rows", () => {
    const csv = ["amount,inn", "abc,111"].join("\n");
    const r = parseBankTransferCsv(csv);
    expect(r.items).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("parseBankTransferXlsx / object rows", () => {
  it("parses object rows like sheet_to_json", () => {
    const r = parseBankTransferObjectRows([
      { сумма: "250000", инн: "305999888", плательщик: "ООО Excel" }
    ]);
    expect(r.errors).toHaveLength(0);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.amount).toBe(250000);
    expect(r.items[0]!.payer_inn).toBe("305999888");
  });

  it("parses real xlsx buffer", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["сумма", "инн", "плательщик"],
      [120000, "301112233", "ООО Sheet"]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const r = parseBankTransferXlsx(buf);
    expect(r.errors).toHaveLength(0);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.amount).toBe(120000);
    expect(r.items[0]!.payer_inn).toBe("301112233");
  });

  it("parses xlsx_base64", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{ amount: 99000, inn: "123456789" }]);
    XLSX.utils.book_append_sheet(wb, ws, "t");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const r = parseBankTransferXlsxBase64(buf.toString("base64"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.amount).toBe(99000);
  });
});

describe("FakeBankTransferAdapter", () => {
  it("returns three sample rows with stable external_id prefix", async () => {
    const { FakeBankTransferAdapter } = await import(
      "../src/modules/bank-transfer-inbox/bank-transfer-inbox.adapters"
    );
    const adapter = new FakeBankTransferAdapter("bank_api", {
      runId: "ut-run",
      sampleInn: "305123456"
    });
    const rows = await adapter.fetchPending();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.external_id)).toEqual([
      "ut-run-exact",
      "ut-run-unmatched",
      "ut-run-no-ids"
    ]);
    expect(rows[0]!.payer_inn).toBe("305123456");
    expect(rows[0]!.amount).toBeGreaterThan(0);
    expect(rows[1]!.payer_inn).toBe("000000000");
  });
});
