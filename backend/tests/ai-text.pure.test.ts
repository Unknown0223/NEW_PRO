/** Pure logic tests — text/number helpers (no DB). */
import { describe, it, expect } from "vitest";
import { normalizeText, has, money, parseAmount, toNumber, extractQuoted, truncate, escapeRegExp } from "../src/modules/ai/ai.text";

describe("normalizeText", () => {
  it("kirill→lotin, pastda bo‘lgan belgilar o‘chiradi", () => {
    expect(normalizeText("Salom, Dunyo!")).toBe("salom dunyo");
    expect(normalizeText("Ҳато")).toContain("hato");
  });
  it("bo‘sh qiymat", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("has", () => {
  it("bir necha kalit so‘zlaridan birini topadi", () => {
    expect(has("bugun savdo qancha", "savdo", "tushum")).toBe(true);
    expect(has("qarzlar", "savdo")).toBe(false);
  });
});

describe("money", () => {
  it("raqamni formatlaydi", () => {
    expect(money(150000)).toBe("150 000");
    expect(money(0)).toBe("0");
    expect(money(null as unknown as number)).toBe("—");
  });
});

describe("parseAmount", () => {
  it("1.5 mln → 1500000", () => {
    expect(parseAmount("1.5 mln")).toBe(1_500_000);
  });
  it("500 ming → 500000", () => {
    expect(parseAmount("500 ming")).toBe(500_000);
  });
  it("150k → 150000", () => {
    expect(parseAmount("150k")).toBe(150_000);
  });
  it("plain number", () => {
    expect(parseAmount("12 500")).toBe(12_500);
    expect(parseAmount("1,250.50")).toBeCloseTo(1250.5);
  });
  it("not a number → undefined", () => {
    expect(parseAmount("savdo")).toBeUndefined();
  });
});

describe("toNumber", () => {
  it("string raqamni qabul qiladi", () => {
    expect(toNumber("1 234")).toBe(1234);
    expect(toNumber("abc")).toBeUndefined();
  });
});

describe("extractQuoted", () => {
  it("tirnoq ichini ajratadi", () => {
    expect(extractQuoted("nomi 'Yangi MMC' qil")).toBe("Yangi MMC");
    expect(extractQuoted("hech nima yo‘q")).toBeUndefined();
  });
});

describe("truncate", () => {
  it("uzun matnni qisqartiradi", () => {
    expect(truncate("salom dunyo", 5)).toBe("salom...");
  });
  it("qisqa matn o‘zgarmaydi", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });
});

describe("escapeRegExp", () => {
  it("xususiy belgilarni emaslaydi", () => {
    expect(escapeRegExp("a.b[c]")).toBe("a\\.b\\[c\\]");
  });
});
