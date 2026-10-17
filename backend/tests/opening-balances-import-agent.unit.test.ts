import { describe, expect, it } from "vitest";
import { isIncompleteOpeningBalanceImportRow } from "../src/modules/opening-balances/opening-balances.import.row";
import {
  excelAgentMatchesCard,
  pickOpeningBalanceAgent
} from "../src/modules/opening-balances/opening-balances.import.agent";

describe("opening-balance import agent pick", () => {
  it("uses Excel agent when found, even if the card has a different agent", () => {
    const r = pickOpeningBalanceAgent({
      excelAgentId: 171,
      cardAgentId: 8,
      excelCode: "PMXRZ002"
    });
    expect(r).toEqual({ ok: true, agentId: 171, warning: null, source: "excel" });
  });

  it("falls back to the card agent and warns when Excel code is unknown", () => {
    const r = pickOpeningBalanceAgent({
      excelAgentId: null,
      cardAgentId: 8,
      excelCode: "PMXRZ002"
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.agentId).toBe(8);
    expect(r.source).toBe("card");
    expect(r.warning).toMatch(/PMXRZ002/);
    expect(r.warning).toMatch(/карточки/);
  });

  it("uses the card agent silently when Excel has no agent code", () => {
    const r = pickOpeningBalanceAgent({
      excelAgentId: null,
      cardAgentId: 8,
      excelCode: ""
    });
    expect(r).toEqual({ ok: true, agentId: 8, warning: null, source: "card" });
  });

  it("rejects when neither Excel nor the card has an agent", () => {
    expect(
      pickOpeningBalanceAgent({ excelAgentId: null, cardAgentId: null, excelCode: "PMXRZ002" })
    ).toEqual({ ok: false, error: "NO_AGENT" });
  });

  it("treats the same person via code or login as a match", () => {
    expect(excelAgentMatchesCard("PMXRZ002", "PMXRZ002", "770712")).toBe(true);
    expect(excelAgentMatchesCard("770712", "PMXRZ002", "770712")).toBe(true);
    expect(excelAgentMatchesCard("pmxrz002", "pmxrz002", null)).toBe(true);
    expect(excelAgentMatchesCard("PMXRZ002", "T-AG-03", "test_komanda_ag_03")).toBe(false);
  });
});

describe("opening-balance import incomplete rows", () => {
  const full = {
    clientId: "a4_405",
    region: "XORAZM VILOYATI",
    agentCode: "PMXRZ002",
    amount: "-1000"
  };

  it("accepts a complete row", () => {
    expect(isIncompleteOpeningBalanceImportRow(full)).toBe(false);
  });

  it("skips when any required column is empty", () => {
    expect(isIncompleteOpeningBalanceImportRow({ ...full, clientId: "" })).toBe(true);
    expect(isIncompleteOpeningBalanceImportRow({ ...full, region: "  " })).toBe(true);
    expect(isIncompleteOpeningBalanceImportRow({ ...full, agentCode: "" })).toBe(true);
    expect(isIncompleteOpeningBalanceImportRow({ ...full, amount: "" })).toBe(true);
  });
});
