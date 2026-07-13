import { describe, expect, it } from "vitest";
import {
  SoftVoidError,
  assertIsVoided,
  assertNotVoided,
  catalogDeactivateData,
  catalogRestoreData,
  isVoidedCode,
  normalizeVoidActor,
  normalizeVoidReason,
  requireRestoreComment,
  restoreCodeFromVoidSuffix,
  restoreVoidedCode,
  softRestoreData,
  softVoidData,
  softVoidListFilter,
  voidCodeSuffix
} from "../src/lib/soft-void";

describe("soft-void helpers", () => {
  const fixedNow = new Date("2026-07-13T10:00:00.000Z");

  it("softVoidData sets deleted_at / actor / reason", () => {
    expect(softVoidData(7, "  reason  ", { now: fixedNow })).toEqual({
      deleted_at: fixedNow,
      deleted_by_user_id: 7,
      delete_reason_ref: "reason"
    });
    expect(softVoidData(null, null, { includeReason: false, now: fixedNow })).toEqual({
      deleted_at: fixedNow,
      deleted_by_user_id: null
    });
  });

  it("softRestoreData clears void fields", () => {
    expect(softRestoreData()).toEqual({
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason_ref: null
    });
    expect(softRestoreData({ includeReason: false })).toEqual({
      deleted_at: null,
      deleted_by_user_id: null
    });
  });

  it("softVoidListFilter: active / archive / includeAll", () => {
    expect(softVoidListFilter()).toEqual({ deleted_at: null });
    expect(softVoidListFilter(false)).toEqual({ deleted_at: null });
    expect(softVoidListFilter(true)).toEqual({ deleted_at: { not: null } });
    expect(softVoidListFilter(true, { includeAll: true })).toEqual({});
  });

  it("voidCodeSuffix / restore keep unique codes within maxLen", () => {
    expect(voidCodeSuffix("BRAND", 42)).toBe("BRAND__void_42");
    expect(isVoidedCode("BRAND__void_42")).toBe(true);
    expect(restoreVoidedCode("BRAND__void_42")).toBe("BRAND");
    expect(restoreCodeFromVoidSuffix("BRAND__void_42", 42)).toBe("BRAND");
    expect(restoreCodeFromVoidSuffix("BRAND__void_99", 42)).toBe("BRAND__void_99");
    const long = "X".repeat(70);
    expect(voidCodeSuffix(long, 1, 64).length).toBeLessThanOrEqual(64);
    expect(isVoidedCode(voidCodeSuffix(long, 1, 64))).toBe(true);
  });

  it("catalogDeactivateData / catalogRestoreData toggle is_active + code", () => {
    expect(catalogDeactivateData("ACME", 9)).toEqual({
      is_active: false,
      code: "ACME__void_9"
    });
    expect(catalogRestoreData("ACME__void_9", 9)).toEqual({
      is_active: true,
      code: "ACME"
    });
    expect(catalogDeactivateData(null, 1)).toEqual({ is_active: false });
  });

  it("assert / require helpers", () => {
    expect(() => assertNotVoided(null)).toThrow(SoftVoidError.NOT_FOUND);
    expect(() => assertNotVoided({ deleted_at: fixedNow })).toThrow(SoftVoidError.ALREADY_VOIDED);
    expect(() => assertNotVoided({ deleted_at: null })).not.toThrow();
    expect(() => assertIsVoided({ deleted_at: null })).toThrow(SoftVoidError.NOT_VOIDED);
    expect(() => requireRestoreComment("  ")).toThrow(SoftVoidError.RESTORE_COMMENT_REQUIRED);
    expect(requireRestoreComment(" ok ")).toBe("ok");
    expect(normalizeVoidActor(0)).toBeNull();
    expect(normalizeVoidActor(3.9)).toBe(3);
    expect(normalizeVoidReason("")).toBeNull();
    expect(normalizeVoidReason("a".repeat(200))?.length).toBe(128);
  });
});
