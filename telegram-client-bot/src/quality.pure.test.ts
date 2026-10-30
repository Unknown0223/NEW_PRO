import { describe, expect, it } from "vitest";
import {
  applyInn,
  applyLatinUpperName,
  applyPhone,
  applyPinfl,
  findClientQualityIssue,
  haversineMeters,
  hasCyrillicLetters,
  hasLatinLowercase,
  missingRequiredFields
} from "./quality.js";

describe("latin uppercase intake", () => {
  it("accepts latin uppercase", () => {
    expect(applyLatinUpperName("ANVARBEK MCHJ")).toEqual({ ok: true, name: "ANVARBEK MCHJ" });
  });

  it("accepts latin lowercase and stores uppercase", () => {
    expect(applyLatinUpperName("Anvarbek MCHJ", "Nomi")).toEqual({
      ok: true,
      name: "ANVARBEK MCHJ"
    });
    expect(applyLatinUpperName("kales", "Manzil")).toEqual({ ok: true, name: "KALES" });
  });

  it("rejects cyrillic address like луАул", () => {
    expect(hasCyrillicLetters("луАул")).toBe(true);
    expect(hasLatinLowercase("луАул")).toBe(false);
    const r = applyLatinUpperName("луАул", "Manzil");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("LUAUL");
    expect(r.message).toContain("Kiril");
  });

  it("rejects mixed cyrillic uppercase", () => {
    const r = applyLatinUpperName("ЛУАУЛ", "Manzil");
    expect(r.ok).toBe(false);
  });
});

describe("phone / INN / PINFL filters", () => {
  it("accepts 9–15 digit phones", () => {
    expect(applyPhone("+998901112233").ok).toBe(true);
    expect(applyPhone("123").ok).toBe(false);
    expect(applyPhone("1234567890123456").ok).toBe(false);
  });

  it("requires INN 9 digits when provided", () => {
    expect(applyInn("").ok).toBe(true);
    expect(applyInn("123456789")).toEqual({ ok: true, inn: "123456789" });
    expect(applyInn("12").ok).toBe(false);
  });

  it("requires PINFL 14 digits when provided", () => {
    expect(applyPinfl("").ok).toBe(true);
    expect(applyPinfl("12345678901234")).toEqual({ ok: true, pinfl: "12345678901234" });
    expect(applyPinfl("123").ok).toBe(false);
  });

  it("rejects duplicate phone", () => {
    const issue = findClientQualityIssue(
      { name: "A", phoneDigits: "998901112233" },
      [{ id: 7, name: "B", phoneDigits: "998901112233" }]
    );
    expect(issue?.kind).toBe("phone");
    expect(issue?.message).toMatch(/unikal|takror/i);
  });

  it("rejects duplicate INN and PINFL", () => {
    expect(
      findClientQualityIssue({ name: "A", inn: "123456789" }, [{ id: 1, name: "B", inn: "123456789" }])
        ?.kind
    ).toBe("inn");
    expect(
      findClientQualityIssue(
        { name: "A", pinfl: "12345678901234" },
        [{ id: 1, name: "B", pinfl: "12345678901234" }]
      )?.kind
    ).toBe("pinfl");
  });
});

describe("GPS 100m similar-name filter", () => {
  const here = { lat: 41.3111, lon: 69.2797 };
  const near = { lat: 41.31155, lon: 69.2797 };
  const far = { lat: 41.32, lon: 69.2797 };

  it("near point is within 100 m", () => {
    expect(haversineMeters(here.lat, here.lon, near.lat, near.lon)).toBeLessThan(100);
    expect(haversineMeters(here.lat, here.lon, far.lat, far.lon)).toBeGreaterThan(100);
  });

  it("blocks similar name inside 100 m", () => {
    const issue = findClientQualityIssue(
      { name: "ANVARBEK MCHJ", lat: here.lat, lon: here.lon },
      [{ id: 9, name: "ANVARBEK MCHJ", lat: near.lat, lon: near.lon }]
    );
    expect(issue?.kind).toBe("geo_name");
  });

  it("allows similar name outside 100 m", () => {
    const issue = findClientQualityIssue(
      { name: "ANVARBEK MCHJ", lat: here.lat, lon: here.lon },
      [{ id: 9, name: "ANVARBEK MCHJ", lat: far.lat, lon: far.lon }]
    );
    expect(issue).toBeNull();
  });
});

describe("required fields", () => {
  it("lists missing name address phone city gps", () => {
    expect(missingRequiredFields({})).toEqual(["Nomi", "Manzil", "Telefon", "Shahar", "GPS"]);
    expect(
      missingRequiredFields({
        name: "A",
        address: "B",
        phone: "1",
        city: "C",
        lat: 1
      })
    ).toEqual([]);
  });
});
