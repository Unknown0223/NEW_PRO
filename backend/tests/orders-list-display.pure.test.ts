import { describe, expect, it } from "vitest";
import { formatVisitWeekdaysRuAbbrev } from "../src/modules/clients/clients.visit-weekdays";

describe("orders list display fields", () => {
  it("formats visit weekdays for День column", () => {
    expect(formatVisitWeekdaysRuAbbrev([1, 3, 5])).toBe("Пн,Ср,Пт");
    expect(formatVisitWeekdaysRuAbbrev([])).toBe("");
  });
});
