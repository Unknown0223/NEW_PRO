import { describe, expect, it } from "vitest";
import { fieldVisitLocationBlock, photoReportIsRequired } from "../src/modules/mobile/mobile-field-visit.pure";

describe("photoReportIsRequired", () => {
  it("is on when the workplace photo checkbox is on", () => {
    expect(photoReportIsRequired({ photo: { required_for_order: true } })).toBe(true);
  });

  it("is on when the expeditor visit photo checkbox is on", () => {
    expect(
      photoReportIsRequired({ expeditor: { require_photo_report_before_visit: true } })
    ).toBe(true);
  });

  it("is off when neither checkbox is on", () => {
    expect(photoReportIsRequired({ photo: { required_for_order: false } })).toBe(false);
    expect(photoReportIsRequired(null)).toBe(false);
  });
});

describe("fieldVisitLocationBlock", () => {
  it("asks for GPS when the order GPS flag is on and there is no fix", () => {
    expect(
      fieldVisitLocationBlock({
        gpsRequired: true,
        radiusM: null,
        latitude: null,
        longitude: null,
        clientLat: 41.3,
        clientLng: 69.2
      })
    ).toBe("GPS_REQUIRED");
  });

  it("blocks a fix outside the configured outlet radius", () => {
    expect(
      fieldVisitLocationBlock({
        gpsRequired: false,
        radiusM: 250,
        latitude: 41.31,
        longitude: 69.2,
        clientLat: 41.3,
        clientLng: 69.2
      })
    ).toBe("OUT_OF_RADIUS");
  });

  it("allows a nearby fix and skips distance when the client has no coordinates", () => {
    expect(
      fieldVisitLocationBlock({
        gpsRequired: false,
        radiusM: 250,
        latitude: 41.3,
        longitude: 69.2,
        clientLat: 41.3,
        clientLng: 69.2
      })
    ).toBeNull();
    expect(
      fieldVisitLocationBlock({
        gpsRequired: false,
        radiusM: 250,
        latitude: 41.5,
        longitude: 69.5,
        clientLat: null,
        clientLng: null
      })
    ).toBeNull();
  });
});
