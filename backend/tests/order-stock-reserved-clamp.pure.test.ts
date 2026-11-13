import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

/** reserved release clamp — stock_reserved_qty_nonneg bilan bir xil mantiq. */
function clampReservedAfterRelease(reserved: Prisma.Decimal, release: Prisma.Decimal): Prisma.Decimal {
  const next = reserved.sub(release);
  return next.lt(0) ? new Prisma.Decimal(0) : next;
}

describe("reserved_qty clamp on release", () => {
  it("does not go negative when reserved is already 0", () => {
    expect(clampReservedAfterRelease(new Prisma.Decimal(0), new Prisma.Decimal(1)).toString()).toBe("0");
  });

  it("reduces when enough reserved", () => {
    expect(clampReservedAfterRelease(new Prisma.Decimal(25), new Prisma.Decimal(1)).toString()).toBe("24");
  });

  it("floors at 0 when release exceeds reserved", () => {
    expect(clampReservedAfterRelease(new Prisma.Decimal(3), new Prisma.Decimal(10)).toString()).toBe("0");
  });
});
