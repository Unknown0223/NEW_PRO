import { describe, expect, it } from "vitest";
import {
  REPORT_MENU_STUBS,
  REPORT_STUB_FALLBACK_REASON,
  reportStubReason,
  reportStubTitle
} from "@/lib/report-menu-stubs";

describe("report-menu-stubs (deferred SalesDoc leftovers)", () => {
  it("keeps only domain-blocked stubs: feedback, nr, tare", () => {
    expect(REPORT_MENU_STUBS.map((s) => s.slug).sort()).toEqual(["feedback", "nr", "tare"]);
  });

  it("exposes human title and permanent defer reason per slug", () => {
    for (const stub of REPORT_MENU_STUBS) {
      expect(reportStubTitle(stub.slug)).toBe(stub.label);
      expect(reportStubReason(stub.slug)).toBe(stub.reason);
    }
    expect(reportStubReason("tare")).toMatch(/taradoc/i);
    expect(reportStubReason("feedback")).toMatch(/feedbackReport/i);
    expect(reportStubReason("nr")).toMatch(/не найден/i);
  });

  it("falls back safely for unknown slug", () => {
    expect(reportStubTitle("nope")).toBe("Отчёт");
    expect(reportStubReason("nope")).toBe(REPORT_STUB_FALLBACK_REASON);
  });
});
