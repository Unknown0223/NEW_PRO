import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_VISIT_RADIUS_M,
  distanceMeters,
  evaluateOrderVisit,
  resolveOrderVisitRadiusM
} from "../src/modules/mobile/mobile-order-visit.pure";

const now = new Date("2026-10-04T10:00:00.000Z");
const client = { lat: 41.311081, lng: 69.240562 };
const base = {
  client_id: 5,
  started_at: "2026-10-04T09:50:00.000Z",
  latitude: 41.31115,
  longitude: 69.2406,
  accuracy_m: 10
};

function run(visit: Parameters<typeof evaluateOrderVisit>[0]["visit"], extra: Partial<Parameters<typeof evaluateOrderVisit>[0]> = {}) {
  return evaluateOrderVisit({
    visit,
    clientId: 5,
    clientLat: client.lat,
    clientLng: client.lng,
    configRadiusM: null,
    strict: true,
    now,
    ...extra
  });
}

describe("mobile order visit guard", () => {
  it("distance and default radius", () => {
    expect(distanceMeters(41.311081, 69.240562, 41.311081, 69.240562)).toBe(0);
    expect(Math.round(distanceMeters(41.0, 69.0, 41.001, 69.0))).toBe(111);
    expect(resolveOrderVisitRadiusM(null)).toBe(DEFAULT_ORDER_VISIT_RADIUS_M);
    expect(resolveOrderVisitRadiusM(0)).toBe(DEFAULT_ORDER_VISIT_RADIUS_M);
    expect(resolveOrderVisitRadiusM(150)).toBe(150);
  });

  it("missing visit: strict rejects, legacy app passes with marker", () => {
    expect(run(null)).toEqual({ ok: false, code: "VISIT_REQUIRED" });
    const legacy = run(undefined, { strict: false });
    expect(legacy.ok && legacy.geo.legacy).toBe(true);
  });

  it("accepts a visit inside radius and records distances", () => {
    const r = run({ ...base, order_latitude: 41.3111, order_longitude: 69.2406 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.geo.distance_m).toBeLessThan(20);
      expect(r.geo.radius_m).toBe(300);
      expect(r.geo.order_distance_m).toBeLessThan(20);
      expect(r.startedAt?.toISOString()).toBe(base.started_at);
    }
  });

  it("rejects wrong client, mocked GPS, bad or stale time", () => {
    expect(run({ ...base, client_id: 6 })).toMatchObject({ ok: false, code: "VISIT_CLIENT_MISMATCH" });
    expect(run({ ...base, is_mocked: true })).toMatchObject({ ok: false, code: "VISIT_MOCK_LOCATION" });
    expect(run({ ...base, order_is_mocked: true })).toMatchObject({ ok: false, code: "VISIT_MOCK_LOCATION" });
    expect(run({ ...base, started_at: "not-a-date" })).toMatchObject({ ok: false, code: "VISIT_BAD_TIME" });
    expect(run({ ...base, started_at: "2026-10-04T11:00:00.000Z" })).toMatchObject({ ok: false, code: "VISIT_BAD_TIME" });
    expect(run({ ...base, started_at: "2026-10-02T09:00:00.000Z" })).toMatchObject({ ok: false, code: "VISIT_STALE" });
  });

  it("rejects out of radius, honours config radius and accuracy tolerance", () => {
    const far = { ...base, latitude: 41.3150, longitude: 69.2406 };
    expect(run(far)).toMatchObject({ ok: false, code: "VISIT_OUT_OF_RADIUS" });
    expect(run(far, { configRadiusM: 1000 }).ok).toBe(true);
    const edge = { ...base, latitude: 41.311081 + 320 / 111_195, longitude: client.lng, accuracy_m: 40 };
    expect(run(edge).ok).toBe(true);
    expect(run({ ...edge, accuracy_m: 5 })).toMatchObject({ ok: false, code: "VISIT_OUT_OF_RADIUS" });
  });

  it("client without coordinates passes but is marked", () => {
    const r = run(base, { clientLat: null, clientLng: null });
    expect(r.ok && r.geo.client_has_coords).toBe(false);
  });
});
