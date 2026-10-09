import { describe, expect, it } from "vitest";
import type { ImportUpdateUniqueConflict } from "../src/modules/clients/clients.import.update-uniques";
import {
  CLIENT_UNIQUE_ERROR_HTTP,
  clientUniqueHttp,
  errorCodeForUniqueConflict,
  pickPrimaryUniqueConflict,
  uniqueConflictErrorCode
} from "../src/modules/clients/clients.write.uniques";

describe("agent/web client unique fields", () => {
  it("maps each unique field to a stable error code", () => {
    expect(uniqueConflictErrorCode("name")).toBe("DUPLICATE_NAME");
    expect(uniqueConflictErrorCode("phone")).toBe("DUPLICATE_PHONE");
    expect(uniqueConflictErrorCode("client_code")).toBe("DUPLICATE_CLIENT_CODE");
    expect(uniqueConflictErrorCode("inn")).toBe("DUPLICATE_INN");
    expect(uniqueConflictErrorCode("client_pinfl")).toBe("DUPLICATE_PINFL");
    expect(uniqueConflictErrorCode("identity")).toBe("DUPLICATE_CLIENT");
    expect(uniqueConflictErrorCode("geo_name")).toBe("DUPLICATE_GEO_NAME");
  });

  it("prefers phone/code/INN over name when several fields collide", () => {
    const conflicts: ImportUpdateUniqueConflict[] = [
      { field: "name", value: "Shop", otherClientId: 1, otherIsActive: true },
      { field: "phone", value: "998901112233", otherClientId: 2, otherIsActive: true },
      { field: "inn", value: "123456789", otherClientId: 3, otherIsActive: true }
    ];
    expect(pickPrimaryUniqueConflict(conflicts)?.field).toBe("phone");
  });

  it("prefers identity over bare name", () => {
    const conflicts: ImportUpdateUniqueConflict[] = [
      { field: "name", value: "Shop", otherClientId: 1, otherIsActive: true },
      { field: "identity", value: "Shop", otherClientId: 1, otherIsActive: true }
    ];
    expect(pickPrimaryUniqueConflict(conflicts)?.field).toBe("identity");
  });

  it("exposes HTTP payloads for mobile create", () => {
    expect(clientUniqueHttp("DUPLICATE_PHONE")).toEqual(CLIENT_UNIQUE_ERROR_HTTP.DUPLICATE_PHONE);
    expect(clientUniqueHttp("DUPLICATE_INN")?.error).toBe("DuplicateInn");
    expect(clientUniqueHttp("DUPLICATE_CLIENT_CODE")?.error).toBe("DuplicateClientCode");
    expect(clientUniqueHttp("DUPLICATE_PINFL")?.error).toBe("DuplicatePinfl");
    expect(clientUniqueHttp("DUPLICATE_CLIENT")?.error).toBe("DuplicateClient");
    expect(clientUniqueHttp("DUPLICATE_GEO_NAME")?.error).toBe("DuplicateGeoName");
    expect(clientUniqueHttp("UNKNOWN")).toBeNull();
  });

  it("reports inactive duplicate instead of the field code", () => {
    expect(
      errorCodeForUniqueConflict({
        field: "phone",
        value: "998901112233",
        otherClientId: 4,
        otherIsActive: false
      })
    ).toBe("DUPLICATE_INACTIVE");
    expect(clientUniqueHttp("DUPLICATE_INACTIVE")?.error).toBe("DuplicateInactive");
  });
});
