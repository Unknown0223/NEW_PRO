/** Pure logic tests — enhanced NLU (no DB, no network). */
import { describe, it, expect } from "vitest";
import {
  hasKeyword,
  matchKeywords,
  extractPeriod,
  extractSku,
  extractAmount,
  extractSearchTerm,
  extractStaffKind,
  extractActive,
  extractStatus,
  extractExportFormat
} from "../src/modules/ai/ai.nlu";

describe("hasKeyword — sinonimlar", () => {
  it("uz va ru variantlarni topadi", () => {
    expect(hasKeyword("bugungi sotuv qancha", "savdo")).toBe(true);
    expect(hasKeyword("выручка за сегодня", "savdo")).toBe(true);
    expect(hasKeyword("qarzdorlar ro'yxati", "qarz")).toBe(true);
    expect(hasKeyword("задолженность клиентов", "qarz")).toBe(true);
  });
  it("yo'q bo'lsa false", () => {
    expect(hasKeyword("ombor qoldiqi", "savdo")).toBe(false);
  });
});

describe("matchKeywords — typo-qo'llqollik", () => {
  it("typo bo'lgan so'zni topadi", () => {
    const found = matchKeywords("sadv qancha bo'ldi", ["savdo", "qarz"]);
    expect(found).toContain("savdo");
  });
  it("to'g'ri yozilganda ham topadi", () => {
    const found = matchKeywords("savdo hisoboti", ["savdo", "qarz"]);
    expect(found).toContain("savdo");
  });
});

describe("extractPeriod", () => {
  it("shu oy", () => {
    const p = extractPeriod("shu oy savdo", "2026-11-12");
    expect(p?.from).toBe("2026-11-01");
    expect(p?.to).toBe("2026-11-12");
  });
  it("oxirgi 7 kun", () => {
    const p = extractPeriod("oxirgi 7 kun to'lovlar", "2026-11-12");
    expect(p?.from).toBe("2026-11-06");
    expect(p?.to).toBe("2026-11-12");
  });
  it("bugun", () => {
    const p = extractPeriod("bugun savdo", "2026-11-12");
    expect(p?.from).toBe("2026-11-12");
    expect(p?.to).toBe("2026-11-12");
  });
  it("davr topilmasa undefined", () => {
    expect(extractPeriod("nima qila olasan?", "2026-11-12")).toBeUndefined();
  });
});

describe("extractSku", () => {
  it("SKU-001 formatda ajratadi", () => {
    expect(extractSku("SKU-001 narxini 150000 qil")).toBe("SKU-001");
    expect(extractSku("PRD_123 mahsuloti")).toBe("PRD_123");
  });
  it("SKU yo'q bo'lsa undefined", () => {
    expect(extractSku("savdo hisoboti")).toBeUndefined();
  });
});

describe("extractAmount", () => {
  it("1.5 mln → 1500000", () => {
    expect(extractAmount("1.5 mln")).toBe(1_500_000);
  });
  it("500 ming → 500000", () => {
    expect(extractAmount("500 ming")).toBe(500_000);
  });
  it("150k → 150000", () => {
    expect(extractAmount("150k")).toBe(150_000);
  });
  it("plain raqam", () => {
    expect(extractAmount("12 500")).toBe(12_500);
  });
});

describe("extractSearchTerm", () => {
  it("tirnoq ichidan ajratadi", () => {
    expect(extractSearchTerm("mijoz 'Ivanov' telefon")).toBe("Ivanov");
  });
  it("nom: dan keyin ajratadi", () => {
    expect(extractSearchTerm("sku:ABC-123")).toBe("ABC-123");
  });
});

describe("extractStaffKind", () => {
  it("agentni aniqlaydi", () => {
    expect(extractStaffKind("yangi agent qo'sh")).toBe("agent");
    expect(extractStaffKind("ekspeditor ro'yxati")).toBe("expeditor");
    expect(extractStaffKind("skladchik qoldiqi")).toBe("skladchik");
    expect(extractStaffKind("auditor ro'yxati")).toBe("auditor");
  });
  it("aniqlanmasa undefined", () => {
    expect(extractStaffKind("savdo hisoboti")).toBeUndefined();
  });
});

describe("extractActive", () => {
  it("faol/nofaol aniqlanadi", () => {
    expect(extractActive("faol xodimlar")).toBe(true);
    expect(extractActive("nofaol xodimlar")).toBe(false);
    expect(extractActive("bloklangan")).toBe(false);
    expect(extractActive("savdo")).toBeUndefined();
  });
});

describe("extractStatus", () => {
  it("holatni aniqlaydi", () => {
    expect(extractStatus("kutilmoqda buyurtmalar")).toBe("pending");
    expect(extractStatus("tasdiqlandi buyurtmalar")).toBe("confirmed");
    expect(extractStatus("bekor qilingan")).toBe("cancelled");
    expect(extractStatus("bajarildi vazifalar")).toBe("completed");
  });
});

describe("extractExportFormat", () => {
  it("csv va xlsx aniqlanadi", () => {
    expect(extractExportFormat("qarzdorlar csv")).toBe("csv");
    expect(extractExportFormat("savdo excelda")).toBe("xlsx");
    expect(extractExportFormat("fayl yuklab ol")).toBe("xlsx");
    expect(extractExportFormat("savdo qancha")).toBeUndefined();
  });
});
