import { describe, expect, it } from "vitest";
import {
  assertFacesForAccept,
  transitionCover
} from "../src/modules/mobile/cover/cover-state.pure";
import { CoverError, COVER_FACE_REQUIRED } from "../src/modules/mobile/cover/cover-codes";

describe("transitionCover", () => {
  it("ACCEPT kutilmoqda → faol", () => {
    expect(transitionCover("kutilmoqda", "ACCEPT", "counterparty")).toBe("faol");
  });

  it("END faol → tugallandi", () => {
    expect(transitionCover("faol", "END", "svr")).toBe("tugallandi");
  });

  it("REJECT kutilmoqda → rad", () => {
    expect(transitionCover("kutilmoqda", "REJECT", "counterparty")).toBe("rad");
  });

  it("CANCEL kutilmoqda → bekor", () => {
    expect(transitionCover("kutilmoqda", "CANCEL", "requester")).toBe("bekor");
  });

  it("ACCEPT from faol throws", () => {
    expect(() => transitionCover("faol", "ACCEPT", "counterparty")).toThrow(CoverError);
  });
});

describe("assertFacesForAccept", () => {
  it("requires both faces", () => {
    expect(() => assertFacesForAccept(true, false)).toThrow(CoverError);
    try {
      assertFacesForAccept(false, true);
    } catch (e) {
      expect(e).toBeInstanceOf(CoverError);
      expect((e as CoverError).code).toBe(COVER_FACE_REQUIRED);
    }
    expect(() => assertFacesForAccept(true, true)).not.toThrow();
  });
});
