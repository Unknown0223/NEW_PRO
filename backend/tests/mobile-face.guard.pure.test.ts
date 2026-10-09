import { describe, expect, it } from "vitest";
import { FaceGateError, isFaceGateError } from "../src/modules/mobile/mobile-face.guard";
import {
  facePolicyFromMobileConfig,
  isOrderSubmitFaceCheckpoint,
  pickDailyOrderCheckpoints,
  workRegionDateString
} from "../src/modules/mobile/mobile-face.service";

describe("face gate pure", () => {
  it("isOrderSubmitFaceCheckpoint matches next action count", () => {
    expect(
      isOrderSubmitFaceCheckpoint({
        orderActionCount: 2,
        orderVerifyCount: 0,
        maxRandomOrdersPerDay: 5,
        checkpoints: [3, 7]
      })
    ).toBe(true);
    expect(
      isOrderSubmitFaceCheckpoint({
        orderActionCount: 2,
        orderVerifyCount: 0,
        maxRandomOrdersPerDay: 5,
        checkpoints: [1, 7]
      })
    ).toBe(false);
  });

  it("isOrderSubmitFaceCheckpoint respects verify cap", () => {
    expect(
      isOrderSubmitFaceCheckpoint({
        orderActionCount: 2,
        orderVerifyCount: 5,
        maxRandomOrdersPerDay: 5,
        checkpoints: [3]
      })
    ).toBe(false);
  });

  it("isFaceGateError narrows FaceGateError", () => {
    const e = new FaceGateError("x", "FACE_REQUIRED");
    expect(isFaceGateError(e)).toBe(true);
    expect(isFaceGateError(new Error("x"))).toBe(false);
  });

  it("facePolicy + checkpoints still stable", () => {
    const p = facePolicyFromMobileConfig({
      schema_version: 1,
      misc: { face_verification_enabled: true }
    });
    expect(p.enabled).toBe(true);
    const d = workRegionDateString(new Date("2026-08-22T12:00:00Z"));
    const a = pickDailyOrderCheckpoints(7, d, 5);
    expect(a.length).toBeLessThanOrEqual(5);
  });
});
