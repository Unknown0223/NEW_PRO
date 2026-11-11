import { describe, expect, it } from "vitest";
import {
  extractDeviceIngestToken,
  hashDeviceToken,
  isPairingExpired,
  pairingExpiresAt,
  terminalEmployeeWhere
} from "../src/modules/tabel/device-ingest-auth.pure";

describe("extractDeviceIngestToken", () => {
  it("prefers header over query", () => {
    expect(
      extractDeviceIngestToken({
        headers: { "x-device-token": "dev_header" },
        query: { device_token: "dev_query", pairing_code: "605622" }
      })
    ).toBe("dev_header");
  });

  it("reads query device_token and ignores pairing_code", () => {
    expect(
      extractDeviceIngestToken({
        headers: {},
        query: { pairing_code: "605622", device_token: "dev_q" }
      })
    ).toBe("dev_q");
    expect(
      extractDeviceIngestToken({
        headers: {},
        query: { pairing_code: "605622" }
      })
    ).toBeNull();
  });

  it("accepts dt alias", () => {
    expect(extractDeviceIngestToken({ headers: {}, query: { dt: "dev_short" } })).toBe("dev_short");
  });
});

describe("hashDeviceToken", () => {
  it("is stable sha256 hex", () => {
    expect(hashDeviceToken("abc")).toBe(hashDeviceToken(" abc "));
    expect(hashDeviceToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("terminalEmployeeWhere", () => {
  it("matches code and numeric id", () => {
    expect(terminalEmployeeWhere(1, "PMAND008")).toEqual({
      tenant_id: 1,
      is_active: true,
      OR: [{ code: "PMAND008" }]
    });
    expect(terminalEmployeeWhere(1, "11").OR).toEqual([{ code: "11" }, { id: 11 }]);
  });
});

describe("pairing expiry", () => {
  it("expires after TTL", () => {
    const at = pairingExpiresAt(1_000_000);
    expect(isPairingExpired(at, 1_000_000)).toBe(false);
    expect(isPairingExpired(at, at.getTime() + 1)).toBe(true);
    expect(isPairingExpired(null)).toBe(false);
  });
});
