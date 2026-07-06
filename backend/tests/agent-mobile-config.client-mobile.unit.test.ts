import { describe, expect, it } from "vitest";
import {
  assertMobileClientPolicy,
  mobileClientInputToUpdateFields,
  mobileClientPatchToUpdateFields
} from "../src/modules/staff/agent-mobile-config.client-mobile";

describe("agent-mobile-config.client-mobile", () => {
  it("blocks create when can_create is false", () => {
    expect(() =>
      assertMobileClientPolicy({ can_create: false }, { name: "Test Shop", phone: "+998901234567" }, "create")
    ).toThrow("CLIENT_CREATE_FORBIDDEN");
  });

  it("requires configured fields on create", () => {
    expect(() =>
      assertMobileClientPolicy(
        { fields_required: { inn: true } },
        { name: "Test Shop", phone: "+998901234567" },
        "create"
      )
    ).toThrow("VALIDATION");

    expect(() =>
      assertMobileClientPolicy(
        { fields_required: { inn: true } },
        { name: "Test Shop", phone: "+998901234567", inn: "123456789" },
        "create"
      )
    ).not.toThrow();
  });

  it("rejects invalid inn format", () => {
    expect(() =>
      assertMobileClientPolicy(
        { fields_visible: { inn: true } },
        { name: "Test Shop", phone: "+998901234567", inn: "abc" },
        "create"
      )
    ).toThrow("VALIDATION");
  });

  it("blocks coordinates when can_change_client_location is false", () => {
    expect(() =>
      assertMobileClientPolicy(
        { can_change_client_location: false },
        { name: "Test", phone: "+998901234567", latitude: 41.3, longitude: 69.2 },
        "create"
      )
    ).toThrow("CLIENT_LOCATION_FORBIDDEN");
  });

  it("maps mobile input to update fields", () => {
    const mapped = mobileClientInputToUpdateFields({
      name: "Shop",
      phone: "+998901234567",
      client_type_code: "retail",
      region: "Toshkent",
      client_code: "PC01"
    });
    expect(mapped.client_type_code).toBe("retail");
    expect(mapped.region).toBe("Toshkent");
    expect(mapped.client_code).toBe("PC01");
  });

  it("patch mapper only includes provided keys", () => {
    const mapped = mobileClientPatchToUpdateFields({ category: "A", inn: null });
    expect(mapped).toEqual({ category: "A", inn: null });
    expect(mapped).not.toHaveProperty("region");
  });
});
