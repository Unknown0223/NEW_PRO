import { describe, expect, it } from "vitest";
import {
  applyRoleMethod,
  branchChatRowsOf,
  clearRole,
  dictionariesOk,
  faceAntifraudOk,
  kioskLeaderIdsOf,
  latenessOk,
  photoPolicyOk,
  punchVideoOk,
  resolvePunchMethods,
  retentionOk,
  roleMethodValue,
  sectionValid,
  telegramOk,
  userOverridesOf
} from "../components/settings/tabel-settings.logic";

describe("latenessOk", () => {
  it("default qiymatlar bilan o'tadi", () => {
    expect(
      latenessOk({ excusedPerMonth: 3, excusedMaxMinutes: 15, earlyLeaveGraceMinutes: 15 })
    ).toBe(true);
  });

  it("chegaradan chiqqan sonlarni rad etadi", () => {
    expect(
      latenessOk({ excusedPerMonth: 32, excusedMaxMinutes: 15, earlyLeaveGraceMinutes: 15 })
    ).toBe(false);
    expect(
      latenessOk({ excusedPerMonth: 3, excusedMaxMinutes: 0, earlyLeaveGraceMinutes: 15 })
    ).toBe(false);
    expect(
      latenessOk({ excusedPerMonth: 3, excusedMaxMinutes: 15, earlyLeaveGraceMinutes: 241 })
    ).toBe(false);
  });

  it("NaN ni rad etadi", () => {
    expect(
      latenessOk({ excusedPerMonth: Number.NaN, excusedMaxMinutes: 15, earlyLeaveGraceMinutes: 15 })
    ).toBe(false);
  });
});

describe("punchVideoOk", () => {
  it("5..10 oralig'ida o'tadi, min > max ni rad etadi", () => {
    expect(punchVideoOk({ minSec: 5, maxSec: 10 })).toBe(true);
    expect(punchVideoOk({ minSec: 7, maxSec: 7 })).toBe(true);
    expect(punchVideoOk({ minSec: 8, maxSec: 6 })).toBe(false);
    expect(punchVideoOk({ minSec: 4, maxSec: 10 })).toBe(false);
    expect(punchVideoOk({ minSec: 5, maxSec: 11 })).toBe(false);
  });

  it("bo'sh obyektda default 5/10 ishlatiladi", () => {
    expect(punchVideoOk({})).toBe(true);
  });
});

describe("faceAntifraudOk", () => {
  const base = {
    faceMatchThreshold: 0.85,
    sfaceThreshold: 0.45,
    maxGpsAccuracyM: 100,
    maxClockSkewSec: 300,
    livenessDirections: 4
  };

  it("default qiymatlar bilan o'tadi", () => {
    expect(faceAntifraudOk(base)).toBe(true);
  });

  it("Liveness faqat 4 yoki 8 bo'lishi mumkin", () => {
    expect(faceAntifraudOk({ ...base, livenessDirections: 6 })).toBe(false);
    expect(faceAntifraudOk({ ...base, livenessDirections: 8 })).toBe(true);
  });

  it("chegaradan chiqqan qiymatlarni rad etadi", () => {
    expect(faceAntifraudOk({ ...base, faceMatchThreshold: 0.29 })).toBe(false);
    expect(faceAntifraudOk({ ...base, sfaceThreshold: 0.96 })).toBe(false);
    expect(faceAntifraudOk({ ...base, maxGpsAccuracyM: 14 })).toBe(false);
    expect(faceAntifraudOk({ ...base, maxClockSkewSec: 3601 })).toBe(false);
  });
});

describe("telegramOk", () => {
  const rows = [{ branch: "Andijon", chat: "-1001" }];

  it("o'chirilgan bo'lsa — hech narsa talab qilinmaydi", () => {
    expect(telegramOk({ enabled: false }, [])).toBe(true);
  });

  it("yoqilgan bo'lsa token va chat kerak", () => {
    expect(telegramOk({ enabled: true }, [])).toBe(false);
    expect(telegramOk({ enabled: true, botToken: "123:ABC" }, [])).toBe(false);
    expect(telegramOk({ enabled: true, botToken: "123:ABC", defaultChatId: "-100" }, [])).toBe(
      true
    );
    expect(telegramOk({ enabled: true, hasBotToken: true }, rows)).toBe(true);
  });

  it("bo'sh joylardan iborat qiymat hisobga olinmaydi", () => {
    expect(telegramOk({ enabled: true, botToken: "  ", defaultChatId: "  " }, [])).toBe(false);
  });
});

describe("retentionOk va photoPolicyOk", () => {
  it("o'chirilgan siyosat validatsiyadan o'tmaydi talab qilmaydi", () => {
    expect(photoPolicyOk({ enabled: false, retentionValue: 0 })).toBe(true);
    expect(photoPolicyOk({ enabled: true, retentionValue: 0 })).toBe(false);
    expect(photoPolicyOk({ enabled: true, retentionValue: 90, retentionUnit: "day" })).toBe(true);
    expect(photoPolicyOk({ enabled: true, retentionValue: 90, retentionUnit: "hour" })).toBe(false);
  });

  it("to'liq retention config", () => {
    expect(retentionOk({ videoDays: 30, dismissedFacePurgeDays: 30 })).toBe(true);
    expect(retentionOk({ videoDays: 0 })).toBe(false);
    expect(retentionOk({ dismissFacePurgeDays: 1, dismissedFacePurgeDays: 3651 })).toBe(false);
    expect(retentionOk({ compress: { maxEdge: 200 } })).toBe(false);
    expect(retentionOk({ compress: { quality: 96 } })).toBe(false);
  });
});

describe("dictionariesOk", () => {
  const cur = (absence: any[], clearance: any[]) => ({
    dictionaries: { absenceTypes: absence, clearanceItems: clearance }
  });

  it("kamida bittadan yozuv va unikal kodlar kerak", () => {
    expect(dictionariesOk(cur([{ code: "A", labelRu: "А" }], [{ code: "C", labelRu: "Ц" }]))).toBe(
      true
    );
    expect(dictionariesOk(cur([], [{ code: "C", labelRu: "Ц" }]))).toBe(false);
    expect(
      dictionariesOk(
        cur(
          [
            { code: "A", labelRu: "А" },
            { code: "A", labelRu: "Б" }
          ],
          [{ code: "C", labelRu: "Ц" }]
        )
      )
    ).toBe(false);
  });

  it("bo'sh kod yoki bo'sh RU nomi rad etiladi", () => {
    expect(dictionariesOk(cur([{ code: "  ", labelRu: "А" }], [{ code: "C", labelRu: "Ц" }]))).toBe(
      false
    );
    expect(dictionariesOk(cur([{ code: "A", labelRu: "" }], [{ code: "C", labelRu: "Ц" }]))).toBe(
      false
    );
  });
});

describe("sectionValid", () => {
  const ctx = {
    cur: { lateness: { excusedPerMonth: 3, excusedMaxMinutes: 15, earlyLeaveGraceMinutes: 15 } },
    branchChatRows: []
  };

  it("validatsiya talab qilmaydigan bo'limlar uchun null", () => {
    expect(sectionValid("punch-modes", ctx)).toBeNull();
    expect(sectionValid("locations", ctx)).toBeNull();
  });

  it("lateness-rules bo'limini tekshiradi", () => {
    expect(sectionValid("lateness-rules", ctx)).toBe(true);
    expect(
      sectionValid("lateness-rules", { ...ctx, cur: { lateness: { excusedPerMonth: 99 } } })
    ).toBe(false);
  });

  it("bo'lim konfiguratsiyasi yo'q bo'lsa default qiymatlar ishlatiladi", () => {
    expect(sectionValid("punch-video", { cur: {}, branchChatRows: [] })).toBe(true);
    expect(sectionValid("face-antifraud", { cur: {}, branchChatRows: [] })).toBe(true);
    expect(sectionValid("retention", { cur: {}, branchChatRows: [] })).toBe(true);
  });
});

describe("punch modes matritsasi", () => {
  it("bazaviy usullar: faqat aniq false o'chirilgan hisoblanadi", () => {
    expect(resolvePunchMethods({})).toEqual({
      photo: true,
      video: true,
      kiosk: true,
      terminal: true
    });
    expect(resolvePunchMethods({ methods: { video: false, kiosk: false } })).toEqual({
      photo: true,
      video: false,
      kiosk: false,
      terminal: true
    });
  });

  it("rol qiymatlari: meros / on / off", () => {
    const byRole = { agent: { video: true } };
    expect(roleMethodValue(byRole, "agent", "video")).toBe("on");
    expect(roleMethodValue(byRole, "agent", "photo")).toBe("default");
    expect(roleMethodValue(byRole, "cashier", "photo")).toBe("default");
  });

  it("applyRoleMethod: null — merosga qaytaradi va bo'sh guruhni o'chiradi", () => {
    const byRole = applyRoleMethod({}, "agent", "video", false);
    expect(byRole).toEqual({ agent: { video: false } });

    const backToDefault = applyRoleMethod(byRole, "agent", "video", null);
    expect(backToDefault).toEqual({});
  });

  it("applyRoleMethod: ikkinchi kalit qo'shilganda guruh saqlanadi", () => {
    const first = applyRoleMethod({}, "agent", "video", false);
    const second = applyRoleMethod(first, "agent", "photo", true);
    expect(second).toEqual({ agent: { video: false, photo: true } });

    const oneLeft = applyRoleMethod(second, "agent", "photo", null);
    expect(oneLeft).toEqual({ agent: { video: false } });
  });

  it("clearRole butun rolni o'chiradi, boshqalarga tegmaydi", () => {
    const byRole = { agent: { video: false }, cashier: { photo: true } };
    expect(clearRole(byRole, "agent")).toEqual({ cashier: { photo: true } });
  });
});

describe("telegram filial guruhlari", () => {
  it("bo'sh chat ID tashlanadi va alifbo bo'yicha saralanadi", () => {
    const rows = branchChatRowsOf({ branchChatIds: { B: "-2", A: " -1 ", C: "  " } });
    expect(rows).toEqual([
      { branch: "A", chat: "-1" },
      { branch: "B", chat: "-2" }
    ]);
  });
});

describe("overrides va kiosk rahbarlari", () => {
  it("userOverrides: faqat musbat id, default true, id bo'yicha saralanadi", () => {
    const rows = userOverridesOf({
      userOverrides: { 12: { enabled: false }, 3: {}, abc: {}, 0: {} }
    });
    expect(rows).toEqual([
      { id: 3, enabled: true, codeRequired: true },
      { id: 12, enabled: false, codeRequired: true }
    ]);
  });

  it("kioskLeaderIds: musbat butun sonlargina qoladi", () => {
    expect(kioskLeaderIdsOf({ kioskLeaderIds: [5, "7", 0, -3, 2.5, "abc"] })).toEqual([5, 7]);
    expect(kioskLeaderIdsOf({ kioskLeaderIds: null })).toEqual([]);
  });
});
