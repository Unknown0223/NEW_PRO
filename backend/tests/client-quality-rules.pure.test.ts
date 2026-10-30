import { describe, expect, it } from "vitest";
import {
  applyLatinUpperName,
  findClientQualityIssue,
  haversineMeters,
  namesAreSimilar,
  toLatinUppercase
} from "../src/modules/clients/client-quality-rules";

describe("client quality rules", () => {
  it("transliterates uzbek cyrillic to latin uppercase", () => {
    expect(toLatinUppercase("дўкон али")).toBe("DO'KON ALI");
    expect(toLatinUppercase("  Qo'ng'iroq   ")).toBe("QO'NG'IROQ");
  });

  it("rejects leftover non-latin letters after transliteration", () => {
    const bad = applyLatinUpperName("Shop 商店");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toMatch(/латин/i);
  });

  it("accepts latin names of 3+ chars", () => {
    const ok = applyLatinUpperName("do'kon");
    expect(ok).toEqual({ ok: true, name: "DO'KON" });
  });

  it("treats cyrillic and latin shop names as similar", () => {
    expect(namesAreSimilar("Дўкон Али", "DO'KON ALI")).toBe(true);
    expect(namesAreSimilar("MARKET", "OTHER")).toBe(false);
  });

  it("flags duplicate phone/inn/pinfl", () => {
    const peers = [
      { id: 9, name: "A", phoneDigits: "998901112233", inn: "123456789", pinfl: "12345678901234" }
    ];
    expect(findClientQualityIssue({ name: "B", phoneDigits: "99890 111 22 33" }, peers)?.kind).toBe(
      "phone"
    );
    expect(findClientQualityIssue({ name: "B", inn: "123456789" }, peers)?.kind).toBe("inn");
    expect(findClientQualityIssue({ name: "B", pinfl: "12345678901234" }, peers)?.kind).toBe("pinfl");
  });

  it("flags similar name within 100 m", () => {
    const meters = haversineMeters(41.3, 69.27, 41.3004, 69.27);
    expect(meters).toBeLessThan(100);
    const issue = findClientQualityIssue(
      { name: "DO'KON ALI", lat: 41.3004, lon: 69.27 },
      [{ id: 4, name: "Дўкон Али", lat: 41.3, lon: 69.27 }]
    );
    expect(issue?.kind).toBe("geo_name");
    expect(issue?.message).toMatch(/100 м/i);
  });

  it("allows similar name farther than 100 m", () => {
    const issue = findClientQualityIssue(
      { name: "DO'KON ALI", lat: 41.32, lon: 69.27 },
      [{ id: 4, name: "DO'KON ALI", lat: 41.3, lon: 69.27 }]
    );
    expect(issue).toBeNull();
  });
});
