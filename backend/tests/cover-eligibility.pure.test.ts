import { describe, expect, it } from "vitest";
import {
  assertLinkedPair,
  assertOneActivePerDay
} from "../src/modules/mobile/cover/cover-eligibility.pure";
import {
  COVER_ALREADY_ACTIVE,
  COVER_NOT_LINKED,
  CoverError
} from "../src/modules/mobile/cover/cover-codes";

describe("cover eligibility", () => {
  it("rejects non-linked SVR", () => {
    try {
      assertLinkedPair(10, 99);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CoverError);
      expect((e as CoverError).code).toBe(COVER_NOT_LINKED);
    }
  });

  it("accepts linked pair", () => {
    expect(() => assertLinkedPair(5, 5)).not.toThrow();
  });

  it("rejects second active same day", () => {
    try {
      assertOneActivePerDay(true);
      expect.unreachable();
    } catch (e) {
      expect((e as CoverError).code).toBe(COVER_ALREADY_ACTIVE);
    }
  });
});
