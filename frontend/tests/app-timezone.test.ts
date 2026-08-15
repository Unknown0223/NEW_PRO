import { describe, expect, it } from "vitest";
import { formatAppDateTime, formatAppDateTimeShort, partsInAppTz } from "@/lib/app-timezone";

describe("app-timezone Asia/Tashkent (+5)", () => {
  it("converts UTC noon to 17:00 local", () => {
    const p = partsInAppTz("2026-08-08T12:00:00.000Z");
    expect(p).toEqual({
      year: "2026",
      month: "08",
      day: "08",
      hour: "17",
      minute: "00",
      second: "00"
    });
  });

  it("formats list/detail consistently", () => {
    expect(formatAppDateTimeShort("2026-08-08T06:03:00.000Z")).toBe("08.08 11:03");
    expect(formatAppDateTime("2026-08-08T06:03:00.000Z")).toBe("08.08.2026 11:03");
  });
});
