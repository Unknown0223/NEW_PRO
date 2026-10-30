import { describe, expect, it } from "vitest";

/** Pure helpers extracted for notify label / coord change logic mirrors. */
function coordsChanged(
  before: { latitude: number | null; longitude: number | null },
  patch: { latitude?: number | null; longitude?: number | null }
): boolean {
  if (patch.latitude === undefined && patch.longitude === undefined) return false;
  const blat = before.latitude;
  const blon = before.longitude;
  const alat = patch.latitude !== undefined ? patch.latitude : blat;
  const alon = patch.longitude !== undefined ? patch.longitude : blon;
  const round = (n: number | null) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 1e6) / 1e6);
  return round(blat) !== round(alat) || round(blon) !== round(alon);
}

describe("supervisor client shared-change notify triggers", () => {
  it("detects coordinate change", () => {
    expect(coordsChanged({ latitude: 41.3, longitude: 69.2 }, { latitude: 41.31, longitude: 69.2 })).toBe(
      true
    );
    expect(coordsChanged({ latitude: 41.3, longitude: 69.2 }, { latitude: 41.3, longitude: 69.2 })).toBe(
      false
    );
  });

  it("ignores patch without lat/lng", () => {
    expect(coordsChanged({ latitude: 41.3, longitude: 69.2 }, {})).toBe(false);
  });
});
