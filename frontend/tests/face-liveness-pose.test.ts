import { describe, expect, it } from "vitest";
import {
  POSE_LANDMARK,
  POSE_THRESHOLDS,
  classifyDirectionFromDelta,
  directionProgress,
  estimateHeadPoseFromLandmarks,
  matchesRequiredDirection,
  poseDelta,
  type LandmarkPoint
} from "../lib/face-liveness-pose";

function makeLandmarks(overrides: Partial<Record<keyof typeof POSE_LANDMARK, LandmarkPoint>>): LandmarkPoint[] {
  const points: LandmarkPoint[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const left = overrides.leftEyeOuter ?? { x: 0.35, y: 0.4 };
  const right = overrides.rightEyeOuter ?? { x: 0.65, y: 0.4 };
  const nose = overrides.nose ?? { x: 0.5, y: 0.42 };
  const forehead = overrides.forehead ?? { x: 0.5, y: 0.25 };
  const chin = overrides.chin ?? { x: 0.5, y: 0.75 };
  points[POSE_LANDMARK.leftEyeOuter] = left;
  points[POSE_LANDMARK.rightEyeOuter] = right;
  points[POSE_LANDMARK.nose] = nose;
  points[POSE_LANDMARK.forehead] = forehead;
  points[POSE_LANDMARK.chin] = chin;
  return points;
}

describe("face-liveness-pose", () => {
  it("estimateHeadPoseFromLandmarks returns null for short arrays", () => {
    expect(estimateHeadPoseFromLandmarks([])).toBeNull();
    expect(estimateHeadPoseFromLandmarks([{ x: 0, y: 0 }])).toBeNull();
  });

  it("neutral face yields near-zero yaw/pitch", () => {
    const pose = estimateHeadPoseFromLandmarks(makeLandmarks({}));
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.yaw)).toBeLessThan(0.05);
    expect(Math.abs(pose!.pitch)).toBeLessThan(0.15);
  });

  it("nose shifted right in raw frame → positive yaw (user left)", () => {
    const centered = estimateHeadPoseFromLandmarks(makeLandmarks({}));
    const turned = estimateHeadPoseFromLandmarks(
      makeLandmarks({ nose: { x: 0.58, y: 0.48 } })
    );
    expect(centered && turned).toBeTruthy();
    expect(turned!.yaw).toBeGreaterThan(centered!.yaw);
  });

  it("matchesRequiredDirection uses relative delta with documented axes", () => {
    // After baseline, user left = yaw+ in our API; fabricate deltas directly.
    expect(matchesRequiredDirection({ yaw: 0.2, pitch: 0 }, "left")).toBe(true);
    expect(matchesRequiredDirection({ yaw: -0.2, pitch: 0 }, "right")).toBe(true);
    expect(matchesRequiredDirection({ yaw: 0, pitch: 0.2 }, "up")).toBe(true);
    expect(matchesRequiredDirection({ yaw: 0, pitch: -0.2 }, "down")).toBe(true);
    expect(matchesRequiredDirection({ yaw: 0.05, pitch: 0 }, "left")).toBe(false);
  });

  it("diagonal directions require both axes", () => {
    expect(matchesRequiredDirection({ yaw: 0.15, pitch: 0.12 }, "up-left")).toBe(true);
    expect(matchesRequiredDirection({ yaw: 0.15, pitch: 0.01 }, "up-left")).toBe(false);
    expect(matchesRequiredDirection({ yaw: -0.15, pitch: -0.12 }, "down-right")).toBe(true);
  });

  it("poseDelta subtracts baseline", () => {
    const d = poseDelta({ yaw: 0.3, pitch: -0.1 }, { yaw: 0.1, pitch: 0.05 });
    expect(d.yaw).toBeCloseTo(0.2);
    expect(d.pitch).toBeCloseTo(-0.15);
  });

  it("classifyDirectionFromDelta picks strongest axis (4-dir)", () => {
    expect(classifyDirectionFromDelta({ yaw: 0.25, pitch: 0.05 }, 4)).toBe("left");
    expect(classifyDirectionFromDelta({ yaw: -0.25, pitch: 0.05 }, 4)).toBe("right");
    expect(classifyDirectionFromDelta({ yaw: 0.05, pitch: 0.22 }, 4)).toBe("up");
    expect(classifyDirectionFromDelta({ yaw: 0.05, pitch: -0.22 }, 4)).toBe("down");
    expect(classifyDirectionFromDelta({ yaw: 0.02, pitch: 0.02 }, 4)).toBeNull();
  });

  it("classifyDirectionFromDelta returns diagonals in 8-dir mode", () => {
    expect(classifyDirectionFromDelta({ yaw: 0.15, pitch: 0.12 }, 8)).toBe("up-left");
    expect(classifyDirectionFromDelta({ yaw: -0.15, pitch: -0.12 }, 8)).toBe("down-right");
  });

  it("directionProgress is 0..1 and reaches 1 at threshold", () => {
    expect(directionProgress({ yaw: 0, pitch: 0 }, "up")).toBe(0);
    expect(directionProgress({ yaw: 0, pitch: POSE_THRESHOLDS.pitch }, "up")).toBe(1);
    expect(directionProgress({ yaw: POSE_THRESHOLDS.yaw / 2, pitch: 0 }, "left")).toBeCloseTo(0.5);
  });

  it("landmark-based left turn delta matches left after baseline", () => {
    // User left → nose moves right in raw frame → yaw+.
    const baseline = estimateHeadPoseFromLandmarks(
      makeLandmarks({ nose: { x: 0.5, y: 0.42 } })
    )!;
    const leftTurn = estimateHeadPoseFromLandmarks(
      makeLandmarks({ nose: { x: 0.58, y: 0.42 } })
    )!;
    const delta = poseDelta(leftTurn, baseline);
    expect(delta.yaw).toBeGreaterThan(POSE_THRESHOLDS.yaw);
    expect(matchesRequiredDirection(delta, "left")).toBe(true);
  });

  it("landmark-based look-up delta matches up", () => {
    const baseline = estimateHeadPoseFromLandmarks(
      makeLandmarks({ nose: { x: 0.5, y: 0.42 } })
    )!;
    const lookUp = estimateHeadPoseFromLandmarks(
      makeLandmarks({ nose: { x: 0.5, y: 0.32 } })
    )!;
    const delta = poseDelta(lookUp, baseline);
    expect(delta.pitch).toBeGreaterThan(POSE_THRESHOLDS.pitch);
    expect(matchesRequiredDirection(delta, "up")).toBe(true);
  });
});
