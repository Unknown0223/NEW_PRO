import { describe, expect, it } from "vitest";
import {
  SHARE_NOT_SAME_LOCATION,
  SHARE_PHOTO_REQUIRED
} from "../src/modules/mobile/share/share-codes";
import {
  DEFAULT_SHARE_HANDOFF_METERS,
  haversineMeters,
  validateHandoffPair
} from "../src/modules/mobile/share/share-handoff.pure";
import { applyPartialAccept } from "../src/modules/mobile/share/share-accept.pure";

describe("haversineMeters + validateHandoffPair", () => {
  it("same point ≈ 0", () => {
    expect(haversineMeters({ lat: 41.3, lng: 69.2 }, { lat: 41.3, lng: 69.2 })).toBeLessThan(1);
  });

  it("just over 150 m → SHARE_NOT_SAME_LOCATION", () => {
    // ~0.0018° lat ≈ 200 m
    const a = { lat: 41.3, lng: 69.2, photo_key: "a.jpg" };
    const b = { lat: 41.3018, lng: 69.2, photo_key: "b.jpg" };
    expect(haversineMeters(a, b)).toBeGreaterThan(DEFAULT_SHARE_HANDOFF_METERS);
    expect(() => validateHandoffPair(a, b)).toThrow(SHARE_NOT_SAME_LOCATION);
  });

  it("missing photo → SHARE_PHOTO_REQUIRED", () => {
    const a = { lat: 41.3, lng: 69.2, photo_key: "a.jpg" };
    const b = { lat: 41.3, lng: 69.2, photo_key: "" };
    expect(() => validateHandoffPair(a, b)).toThrow(SHARE_PHOTO_REQUIRED);
  });

  it("within radius + photos → ok", () => {
    const a = { lat: 41.3, lng: 69.2, photo_key: "a.jpg" };
    const b = { lat: 41.3005, lng: 69.2, photo_key: "b.jpg" };
    expect(haversineMeters(a, b)).toBeLessThan(DEFAULT_SHARE_HANDOFF_METERS);
    expect(() => validateHandoffPair(a, b)).not.toThrow();
  });
});

describe("applyPartialAccept", () => {
  it("subset accepted; rest unlock for sender", () => {
    const out = applyPartialAccept({
      orderIds: [1, 2, 3],
      acceptedIds: [2]
    });
    expect(out.accepted).toEqual([2]);
    expect(out.rejectedUnlock).toEqual([1, 3]);
    expect(out.kind).toBe("partial");
  });

  it("all accepted → full", () => {
    const out = applyPartialAccept({
      orderIds: [1, 2],
      acceptedIds: [1, 2]
    });
    expect(out.kind).toBe("full");
    expect(out.rejectedUnlock).toEqual([]);
  });

  it("empty accept → reject all", () => {
    const out = applyPartialAccept({ orderIds: [1, 2], acceptedIds: [] });
    expect(out.kind).toBe("reject");
    expect(out.rejectedUnlock).toEqual([1, 2]);
  });
});
