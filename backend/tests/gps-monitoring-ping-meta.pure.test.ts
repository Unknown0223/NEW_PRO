import { describe, expect, it } from "vitest";
import {
  clampBatteryPct,
  nearestPingMeta,
  normalizeGpsNetworkType,
  sortEmployeesActiveFirst
} from "../src/modules/gps-monitoring/gps-monitoring.ping-meta";

describe("normalizeGpsNetworkType", () => {
  it("maps common labels", () => {
    expect(normalizeGpsNetworkType("wifi")).toBe("WiFi");
    expect(normalizeGpsNetworkType("4G")).toBe("4G");
    expect(normalizeGpsNetworkType("lte")).toBe("4G");
    expect(normalizeGpsNetworkType("3g")).toBe("3G");
    expect(normalizeGpsNetworkType("none")).toBe("—");
    expect(normalizeGpsNetworkType(null)).toBe("—");
  });
});

describe("clampBatteryPct", () => {
  it("clamps and rejects invalid", () => {
    expect(clampBatteryPct(55.6)).toBe(56);
    expect(clampBatteryPct(-1)).toBe(null);
    expect(clampBatteryPct(101)).toBe(null);
    expect(clampBatteryPct(null)).toBe(null);
  });
});

describe("nearestPingMeta", () => {
  it("picks nearest ping battery and network", () => {
    const pings = [
      {
        latitude: 41.3,
        longitude: 69.2,
        recorded_at: new Date(2026, 8, 17, 10, 0, 0),
        battery_pct: 40,
        network_type: "3G"
      },
      {
        latitude: 41.311,
        longitude: 69.241,
        recorded_at: new Date(2026, 8, 17, 11, 0, 0),
        battery_pct: 72,
        network_type: "WiFi"
      }
    ];
    const meta = nearestPingMeta(pings, 41.31, 69.24, 11);
    expect(meta.batteryAt).toBe(72);
    expect(meta.internet).toBe("WiFi");
    expect(meta.distanceKm).not.toBeNull();
  });
});

describe("sortEmployeesActiveFirst", () => {
  it("puts inactive after active", () => {
    const sorted = sortEmployeesActiveFirst([
      { name: "B", activeOnDate: false },
      { name: "A", activeOnDate: true },
      { name: "C", activeOnDate: true }
    ]);
    expect(sorted.map((x) => x.name)).toEqual(["A", "C", "B"]);
  });
});
