import { describe, expect, it } from "vitest";
import {
  NO_SUPERVISOR_LABEL,
  isSupervisorRole,
  supervisorDisplayLabel,
  supervisorDisplayNameOrNull
} from "../src/modules/access/access-supervisor-display";

describe("access-supervisor-display", () => {
  it("faqat role=supervisor nomini qaytaradi", () => {
    expect(isSupervisorRole("supervisor")).toBe(true);
    expect(isSupervisorRole("director")).toBe(false);
    expect(
      supervisorDisplayNameOrNull({ name: "DEREKTOR FILIAL", role: "director" })
    ).toBeNull();
    expect(supervisorDisplayNameOrNull({ name: "Aliyev", role: "supervisor" })).toBe("Aliyev");
  });

  it("bo‘sh yoki non-SVR — Без супервайзера", () => {
    expect(supervisorDisplayLabel(null)).toBe(NO_SUPERVISOR_LABEL);
    expect(supervisorDisplayLabel({ name: "X", role: "admin" })).toBe(NO_SUPERVISOR_LABEL);
  });
});
