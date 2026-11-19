import { describe, expect, it } from "vitest";
import {
  balanceDebtFlagLabel,
  parseBalanceControlReportQuery,
  parseBalanceFilter,
  resolveBalanceDebtFlag
} from "../src/modules/reports/balance-control-report.parse";

describe("balance-control parseBalanceFilter", () => {
  it("defaults to all", () => {
    expect(parseBalanceFilter(undefined)).toBe("all");
    expect(parseBalanceFilter("")).toBe("all");
    expect(parseBalanceFilter("unknown")).toBe("all");
  });

  it("accepts debt/credit/zero", () => {
    expect(parseBalanceFilter("debt")).toBe("debt");
    expect(parseBalanceFilter("credit")).toBe("credit");
    expect(parseBalanceFilter("zero")).toBe("zero");
  });
});

describe("balance-control resolveBalanceDebtFlag", () => {
  it("SALEC client_balances sign: negative debt, positive credit", () => {
    expect(resolveBalanceDebtFlag("-100")).toBe("debt");
    expect(resolveBalanceDebtFlag(50)).toBe("credit");
    expect(resolveBalanceDebtFlag("0")).toBe("zero");
    expect(resolveBalanceDebtFlag(0)).toBe("zero");
  });

  it("labels", () => {
    expect(balanceDebtFlagLabel("debt")).toBe("Долг");
    expect(balanceDebtFlagLabel("credit")).toBe("Переплата");
    expect(balanceDebtFlagLabel("zero")).toBe("Ноль");
  });
});

describe("balance-control parseBalanceControlReportQuery", () => {
  it("defaults page and filters", () => {
    const f = parseBalanceControlReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.balance_filter).toBe("all");
    expect(f.agent_ids).toEqual([]);
  });

  it("parses filters", () => {
    const f = parseBalanceControlReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      agent_ids: "3,7",
      client_categories: "A,B",
      territory_1_list: "Z1",
      territory_2_list: "R1",
      territory_3_list: "C1",
      balance_filter: "debt",
      search: "  shop ",
      page: "2",
      limit: "25"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.agent_ids).toEqual([3, 7]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_1_list).toEqual(["Z1"]);
    expect(f.balance_filter).toBe("debt");
    expect(f.search).toBe("shop");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(25);
  });
});