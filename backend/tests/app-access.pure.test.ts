import { describe, expect, it } from "vitest";
import {
  APP_ACCESS_DENIED_MESSAGE,
  APP_ACCESS_ENFORCED_ROLES,
  assertAppAccessAllowed,
  isAppAccessEnforcedRole
} from "../src/modules/auth/app-access.constants";

describe("app-access kill-switch helpers", () => {
  it("enforces mobile field + collector/auditor; admin/operator/skladchik exempt", () => {
    expect(isAppAccessEnforcedRole("agent")).toBe(true);
    expect(isAppAccessEnforcedRole("expeditor")).toBe(true);
    expect(isAppAccessEnforcedRole("supervisor")).toBe(true);
    expect(isAppAccessEnforcedRole("collector")).toBe(true);
    expect(isAppAccessEnforcedRole("auditor")).toBe(true);
    expect(isAppAccessEnforcedRole("admin")).toBe(false);
    expect(isAppAccessEnforcedRole("operator")).toBe(false);
    expect(isAppAccessEnforcedRole("skladchik")).toBe(false);
    expect(APP_ACCESS_ENFORCED_ROLES.has("agent")).toBe(true);
  });

  it("assertAppAccessAllowed throws APP_ACCESS_DENIED only when false for enforced roles", () => {
    expect(() => assertAppAccessAllowed("agent", false)).toThrow("APP_ACCESS_DENIED");
    expect(() => assertAppAccessAllowed("collector", false)).toThrow("APP_ACCESS_DENIED");
    expect(() => assertAppAccessAllowed("agent", true)).not.toThrow();
    expect(() => assertAppAccessAllowed("agent", null)).not.toThrow();
    expect(() => assertAppAccessAllowed("admin", false)).not.toThrow();
    expect(() => assertAppAccessAllowed("operator", false)).not.toThrow();
  });

  it("denial message is bilingual RU/UZ", () => {
    expect(APP_ACCESS_DENIED_MESSAGE).toMatch(/Доступ к приложению/);
    expect(APP_ACCESS_DENIED_MESSAGE).toMatch(/Ilova kirish/);
  });
});
