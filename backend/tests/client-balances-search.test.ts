import { describe, expect, it } from "vitest";
import {
  formatClientDisplayId,
  isExternalClientCode,
  parseExternalClientCodeSuffix
} from "../shared/client-display-id";
import { buildClientBalanceSearchOrClause } from "../src/modules/client-balances/client-balances.where";

describe("client-display-id", () => {
  it("tashqi kod formatini taniydi", () => {
    expect(isExternalClientCode("ur_29411")).toBe(true);
    expect(isExternalClientCode("730")).toBe(false);
  });

  it("suffix ichki id", () => {
    expect(parseExternalClientCodeSuffix("wr_1173")).toBe(1173);
  });

  it("ko‘rinish: client_code ustunlik", () => {
    expect(formatClientDisplayId(124, "ur_29411")).toBe("ur_29411");
    expect(formatClientDisplayId(124, null)).toBe("124");
  });
});

describe("buildClientBalanceSearchOrClause", () => {
  it("tashqi kod — client_code va ichki id", () => {
    const parts = buildClientBalanceSearchOrClause("ur_29411");
    expect(parts).toEqual([
      { client_code: { equals: "ur_29411", mode: "insensitive" } },
      { id: 29411 }
    ]);
  });

  it("raqamli qidiruv — faqat aniq mijoz id", () => {
    const parts = buildClientBalanceSearchOrClause("730");
    expect(parts).toEqual([
      { id: 730 },
      { client_code: { equals: "730", mode: "insensitive" } }
    ]);
    expect(parts.some((p) => "name" in p)).toBe(false);
  });
});
