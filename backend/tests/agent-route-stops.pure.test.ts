import { describe, expect, it } from "vitest";
import {
  appendStopToRouteStops,
  compactClientPhotoUrl,
  isoDatesThisWeekForWeekdays,
  workRegionIsoDate
} from "../src/modules/field/agent-route-stops";

describe("isoDatesThisWeekForWeekdays", () => {
  it("maps weekdays onto the work-region week of the given instant", () => {
    // 2026-09-03 09:00Z = 14:00 Tashkent Thursday (weekday 4)
    const now = new Date("2026-09-03T09:00:00.000Z");
    expect(workRegionIsoDate(now)).toBe("2026-09-03");
    expect(isoDatesThisWeekForWeekdays([1, 4], now)).toEqual(["2026-08-31", "2026-09-03"]);
  });

  it("returns empty for no weekdays", () => {
    expect(isoDatesThisWeekForWeekdays([])).toEqual([]);
    expect(isoDatesThisWeekForWeekdays([0, 8])).toEqual([]);
  });
});

describe("appendStopToRouteStops", () => {
  it("appends a new client and skips duplicates", () => {
    const first = appendStopToRouteStops([], {
      client_id: 10,
      client_name: "A",
      latitude: 41.3,
      longitude: 69.2
    });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ client_id: 10, client_name: "A", sort_order: 1 });

    const again = appendStopToRouteStops(first, {
      client_id: 10,
      client_name: "A"
    });
    expect(again).toHaveLength(1);

    const two = appendStopToRouteStops(first, {
      client_id: 11,
      client_name: "B"
    });
    expect(two.map((s) => s.client_id)).toEqual([10, 11]);
  });
});

describe("compactClientPhotoUrl", () => {
  it("keeps http urls and drops data urls", () => {
    expect(compactClientPhotoUrl("https://cdn.example/p.jpg")).toBe("https://cdn.example/p.jpg");
    expect(compactClientPhotoUrl("data:image/jpeg;base64,aaaa")).toBeUndefined();
    expect(compactClientPhotoUrl("")).toBeUndefined();
  });
});
