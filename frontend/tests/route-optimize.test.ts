import { describe, expect, it } from "vitest";
import { distanceKm, optimizeRoute, routeLengthKm } from "@/lib/agent-route/route-optimize";
import { parseSavedStops } from "@/lib/agent-route/agent-route-api";

const p = (id: number, lat: number | null, lon: number | null) => ({ id, latitude: lat, longitude: lon });

describe("route optimize", () => {
  it("distance between Tashkent points is sane", () => {
    const d = distanceKm(p(1, 41.3, 69.2), p(2, 41.4, 69.2));
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(12);
  });

  it("untangles a zig-zag line and keeps points without coords at the end", () => {
    const input = [p(1, 41.0, 69.0), p(2, 41.3, 69.0), p(3, 41.1, 69.0), p(4, null, null), p(5, 41.2, 69.0)];
    const out = optimizeRoute(input);
    expect(out.map((x) => x.id)).toEqual([1, 3, 5, 2, 4]);
    expect(routeLengthKm(out)).toBeLessThan(routeLengthKm(input));
  });

  it("parses saved stops with legacy keys and sorts them", () => {
    const stops = parseSavedStops([
      { sort_order: 2, client_id: 7, name: "B", lat: "41.1", lon: "69.1" },
      { sort_order: 1, client_id: 5, client_name: "A", latitude: 41, longitude: 69, visited: true },
      { client_id: 0 }
    ]);
    expect(stops.map((s) => s.client_id)).toEqual([5, 7]);
    expect(stops[1]).toMatchObject({ client_name: "B", latitude: 41.1, longitude: 69.1, visited: false });
  });
});
