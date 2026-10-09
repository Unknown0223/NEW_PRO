import { describe, expect, it } from "vitest";
import {
  parseAgentListFilters,
  parseAuditorListFilters,
  parseCollectorListFilters
} from "../src/modules/staff/staff.route.schemas.parsers";

describe("staff territory list filter parsers", () => {
  it("parses agent oblast→city cascade params", () => {
    const f = parseAgentListFilters({
      territory_oblast: "Andijon",
      territory_city: "Asaka"
    });
    expect(f.territory_oblast).toBe("Andijon");
    expect(f.territory_city).toBe("Asaka");
  });

  it("parses collector oblast→city (aligned with expeditors)", () => {
    const f = parseCollectorListFilters({
      is_active: "true",
      territory_oblast: "Namangan",
      territory_city: "Namangan"
    });
    expect(f.is_active).toBe(true);
    expect(f.territory_oblast).toBe("Namangan");
    expect(f.territory_city).toBe("Namangan");
  });

  it("parses auditor oblast→city", () => {
    const f = parseAuditorListFilters({
      territory_oblast: "Buxoro",
      territory_city: "Buxoro"
    });
    expect(f.territory_oblast).toBe("Buxoro");
    expect(f.territory_city).toBe("Buxoro");
  });
});
