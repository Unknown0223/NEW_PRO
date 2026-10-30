import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { pickEffectiveLimit } from "../src/modules/payroll/payroll.advance-limits";

const row = (scope: string, max: number, extra: { role?: string; user_id?: number; is_exception?: boolean } = {}) => ({
  scope,
  role: extra.role ?? null,
  user_id: extra.user_id ?? null,
  max_amount: new Prisma.Decimal(max),
  is_exception: extra.is_exception ?? false
});

describe("pickEffectiveLimit", () => {
  const rows = [row("global", 1_000_000), row("role", 2_000_000, { role: "agent" }), row("user", 5_000_000, { user_id: 7, is_exception: true })];

  it("xodim istisnosi rol va umumiy limitdan ustun", () => {
    expect(pickEffectiveLimit(rows, 7, "agent")).toEqual({ max: 5_000_000, scope: "user", is_exception: true });
  });

  it("rol limiti umumiydan ustun", () => {
    expect(pickEffectiveLimit(rows, 8, "agent")).toEqual({ max: 2_000_000, scope: "role", is_exception: false });
  });

  it("boshqa rol — umumiy limit", () => {
    expect(pickEffectiveLimit(rows, 9, "expeditor")?.max).toBe(1_000_000);
  });

  it("limit yo'q — cheksiz", () => {
    expect(pickEffectiveLimit([], 9, "agent")).toBeNull();
  });
});
