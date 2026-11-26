import { describe, expect, it } from "vitest";
import {
  VISITS_SEED_CLIENT_NAME,
  VISITS_SEED_NOTE,
  isLocalDatabaseUrl
} from "../src/modules/reports/visits-report.seed-meta";

describe("visits report seed meta", () => {
  it("uses dedicated client name and note prefix", () => {
    expect(VISITS_SEED_NOTE).toBe("VISITS-SEED");
    expect(VISITS_SEED_CLIENT_NAME).toBe("VISITS-SEED Demo Client");
  });

  it("allows only localhost database urls", () => {
    expect(isLocalDatabaseUrl("postgresql://postgres:x@localhost:15432/savdo_db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres:x@127.0.0.1:15432/savdo_db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres:x@db.example.com:5432/savdo_db")).toBe(false);
  });
});
