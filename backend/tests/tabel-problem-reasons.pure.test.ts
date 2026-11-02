import { describe, expect, it } from "vitest";
import { punchProblemLabels } from "../src/modules/tabel/tabel-problem-reasons.pure";

describe("punchProblemLabels", () => {
  it("geozona, yuz va soxta GPS ni alohida yozadi", () => {
    expect(
      punchProblemLabels({
        outside_geofence: true,
        face_score: 0.4,
        is_valid: false,
        review_status: "pending",
        integrity_json: {
          verdict: "FAKE_GPS_DETECTED",
          layers: [{ code: "FAKE_GPS_DETECTED", passed: false }]
        }
      })
    ).toEqual(["Вне гео-зоны", "Лицо не совпало", "Fake GPS"]);
  });

  it("sof belgini muammo deb yozmaydi", () => {
    expect(
      punchProblemLabels({
        outside_geofence: false,
        face_score: 0.97,
        is_valid: true,
        review_status: "auto",
        integrity_json: { verdict: "ok" }
      })
    ).toEqual([]);
  });
});
