import { describe, expect, it } from "vitest";
import {
  SHARE_INVALID_TRANSITION,
  SHARE_SENDER_CANNOT_ACT
} from "../src/modules/mobile/share/share-codes";
import { transitionShare } from "../src/modules/mobile/share/share-state.pure";

describe("transitionShare", () => {
  it("VIEW: receiver kutilmoqda → korildi", () => {
    expect(transitionShare("kutilmoqda", "VIEW", "receiver")).toBe("korildi");
  });

  it("VIEW: sender cannot view-transition", () => {
    expect(() => transitionShare("kutilmoqda", "VIEW", "sender")).toThrow(
      SHARE_SENDER_CANNOT_ACT
    );
  });

  it("CANCEL: sender on kutilmoqda|korildi → bekor", () => {
    expect(transitionShare("kutilmoqda", "CANCEL", "sender")).toBe("bekor");
    expect(transitionShare("korildi", "CANCEL", "sender")).toBe("bekor");
  });

  it("CANCEL: receiver forbidden", () => {
    expect(() => transitionShare("kutilmoqda", "CANCEL", "receiver")).toThrow(
      SHARE_INVALID_TRANSITION
    );
  });

  it("ACCEPT_FULL: receiver korildi → qabul_qilindi", () => {
    expect(transitionShare("korildi", "ACCEPT_FULL", "receiver")).toBe(
      "qabul_qilindi"
    );
  });

  it("ACCEPT_PARTIAL: receiver korildi → qisman_qabul", () => {
    expect(transitionShare("korildi", "ACCEPT_PARTIAL", "receiver")).toBe(
      "qisman_qabul"
    );
  });

  it("ACCEPT: sender throws SHARE_SENDER_CANNOT_ACT", () => {
    expect(() => transitionShare("korildi", "ACCEPT_FULL", "sender")).toThrow(
      SHARE_SENDER_CANNOT_ACT
    );
  });

  it("REJECT: receiver → rad", () => {
    expect(transitionShare("korildi", "REJECT", "receiver")).toBe("rad");
  });

  it("START_HANDOFF: qabul_qilindi|qisman_qabul → yuk_kutilmoqda", () => {
    expect(transitionShare("qabul_qilindi", "START_HANDOFF", "receiver")).toBe(
      "yuk_kutilmoqda"
    );
    expect(transitionShare("qisman_qabul", "START_HANDOFF", "sender")).toBe(
      "yuk_kutilmoqda"
    );
  });

  it("HANDOFF_OK: yuk_kutilmoqda → faol", () => {
    expect(transitionShare("yuk_kutilmoqda", "HANDOFF_OK", "receiver")).toBe(
      "faol"
    );
    expect(transitionShare("yuk_kutilmoqda", "HANDOFF_OK", "sender")).toBe(
      "faol"
    );
  });

  it("HANDOFF_OK: wrong status → SHARE_INVALID_TRANSITION", () => {
    expect(() =>
      transitionShare("kutilmoqda", "HANDOFF_OK", "receiver")
    ).toThrow(SHARE_INVALID_TRANSITION);
  });

  it("EXPIRE: kutilmoqda|korildi → bekor", () => {
    expect(transitionShare("kutilmoqda", "EXPIRE", "sender")).toBe("bekor");
    expect(transitionShare("korildi", "EXPIRE", "receiver")).toBe("bekor");
  });

  it("EXPIRE: faol not cancelled", () => {
    expect(() => transitionShare("faol", "EXPIRE", "sender")).toThrow(
      SHARE_INVALID_TRANSITION
    );
  });

  it("RETURN_REQUEST: faol → qaytarish_kutilmoqda", () => {
    expect(transitionShare("faol", "RETURN_REQUEST", "receiver")).toBe(
      "qaytarish_kutilmoqda"
    );
  });

  it("RETURN_ACCEPT: → qaytarildi", () => {
    expect(
      transitionShare("qaytarish_kutilmoqda", "RETURN_ACCEPT", "sender")
    ).toBe("qaytarildi");
  });
});
